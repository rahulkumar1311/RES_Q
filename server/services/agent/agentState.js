// Structured operational state for RESQ Disaster Response Agent
// Exposes high-level execution trace and operational state without hidden chain-of-thought

export const AGENT_STATUS = Object.freeze({
  PLANNING: "planning",
  EXECUTING: "executing",
  REPLANNING: "replanning",
  COMPLETED: "completed",
  FAILED: "failed",
});

/**
 * Creates a fresh, validated operational agent state object
 */
export function createInitialAgentState(userRequest = "", options = {}) {
  return {
    requestId: `resq_agent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userRequest: String(userRequest || "").trim(),
    origin: options.origin || null,
    destination: options.destination || null,
    disasterType: options.disasterType || "GENERAL_DISASTER",
    objective: options.objective || "Find and verify a safe route avoiding active disaster hazards",
    status: AGENT_STATUS.PLANNING,
    plan: [],
    toolCalls: [],
    hazards: [],
    candidateRoutes: [],
    recommendedRoute: null,
    executionTrace: [],
    warnings: [],
    iterations: 0,
    maxIterations: options.maxIterations || 10,
    startTime: Date.now(),
    completedAt: null,
  };
}

/**
 * Appends a high-level operational milestone to the execution trace
 * Never stores chain-of-thought or internal reasoning prompts
 */
export function appendExecutionTrace(state, { step, message, status = "completed", details = null }) {
  if (!state.executionTrace) state.executionTrace = [];
  const traceEntry = {
    step: String(step || `step_${state.executionTrace.length + 1}`),
    message: String(message || ""),
    status: status, // "completed" | "in_progress" | "warning" | "failed"
    timestamp: new Date().toISOString(),
  };
  if (details && typeof details === "object") {
    traceEntry.details = details;
  }
  state.executionTrace.push(traceEntry);
  return traceEntry;
}

/**
 * Records a tool execution result into operational state
 */
export function recordToolCall(state, toolRecord) {
  if (!state.toolCalls) state.toolCalls = [];
  state.toolCalls.push({
    tool: toolRecord.tool,
    callId: toolRecord.callId || `call_${state.toolCalls.length + 1}`,
    inputs: toolRecord.inputs || {},
    status: toolRecord.status || "completed", // "completed" | "failed"
    summary: toolRecord.summary || "",
    durationMs: toolRecord.durationMs || 0,
    error: toolRecord.error || null,
    data: toolRecord.data || null,
    timestamp: new Date().toISOString(),
  });
}
