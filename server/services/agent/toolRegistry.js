// Controlled Tool Registry for RESQ Disaster Response Agent
// Enforces schema validation, isolated backend execution, and normalized output format

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  /**
   * Registers a tool with definition and execution handler
   */
  registerTool({ name, description, inputSchema, validateInputs, handler }) {
    if (!name || typeof name !== "string") {
      throw new Error("Tool registration requires a valid string name");
    }
    if (typeof handler !== "function") {
      throw new Error(`Tool '${name}' must provide an execution handler function`);
    }

    this.tools.set(name, {
      name,
      description: description || "",
      inputSchema: inputSchema || {},
      validateInputs: validateInputs || (() => ({ valid: true })),
      handler,
    });
  }

  /**
   * Retrieves a tool definition by name
   */
  getTool(name) {
    return this.tools.get(name) || null;
  }

  /**
   * Lists all available tools and their input schemas (for LLM tool calling and inspection)
   */
  listTools() {
    const list = [];
    for (const [name, def] of this.tools.entries()) {
      list.push({
        name,
        description: def.description,
        inputSchema: def.inputSchema,
      });
    }
    return list;
  }

  /**
   * Executes a tool securely with strict validation and error normalization
   */
  async executeTool(name, inputs = {}, context = {}) {
    const startTime = Date.now();
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        tool: name,
        data: null,
        error: {
          code: "UNKNOWN_TOOL",
          message: `Tool '${name}' is not registered in RESQ Tool Registry. Allowed tools: ${Array.from(this.tools.keys()).join(", ")}`,
        },
        durationMs: Date.now() - startTime,
      };
    }

    // Input schema validation
    try {
      const validation = tool.validateInputs(inputs);
      if (!validation.valid) {
        return {
          success: false,
          tool: name,
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.error || `Invalid arguments provided for tool '${name}'`,
            details: validation.details || null,
          },
          durationMs: Date.now() - startTime,
        };
      }
    } catch (valErr) {
      return {
        success: false,
        tool: name,
        data: null,
        error: {
          code: "VALIDATION_EXCEPTION",
          message: `Schema validator failed for tool '${name}': ${valErr.message}`,
        },
        durationMs: Date.now() - startTime,
      };
    }

    // Controlled tool execution
    try {
      const result = await tool.handler(inputs, context);
      return {
        success: true,
        tool: name,
        data: result,
        error: null,
        durationMs: Date.now() - startTime,
      };
    } catch (execErr) {
      return {
        success: false,
        tool: name,
        data: null,
        error: {
          code: execErr.code || "TOOL_EXECUTION_ERROR",
          message: execErr.message || `Tool '${name}' execution failed`,
          status: execErr.status || 500,
        },
        durationMs: Date.now() - startTime,
      };
    }
  }
}

// Global singleton instance for application agent
export const defaultToolRegistry = new ToolRegistry();
