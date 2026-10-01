// Express router for RESQ Disaster Response Agent API
// Exposes POST /api/agent/run and tool inspection endpoints

import express from "express";
import { runDisasterAgent } from "../services/agent/resqDisasterAgent.js";
import { defaultToolRegistry } from "../services/agent/toolRegistry.js";

const router = express.Router();

/**
 * GET /api/agent/health
 * Agent subsystem health check
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    subsystem: "RESQ Disaster Response Agent",
    status: "OPERATIONAL",
    toolsCount: defaultToolRegistry.listTools().length,
  });
});

/**
 * GET /api/agent/tools
 * Lists registered agent tools and input schemas
 */
router.get("/tools", (req, res) => {
  try {
    const tools = defaultToolRegistry.listTools();
    res.status(200).json({
      success: true,
      count: tools.length,
      tools,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: err.message },
    });
  }
});

/**
 * POST /api/agent/run
 * Primary agent execution endpoint
 */
const handleAgentRun = async (req, res) => {
  try {
    const { query, prompt, origin, destination, disasterType, maxIterations, demoMode = false } = req.body || {};
    const effectiveQuery = query || prompt;

    if (!effectiveQuery && (!origin || !destination)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request must include either a natural language 'query' / 'prompt' string (e.g. 'Find a safe route from Guwahati to Shillong during flood conditions') or explicit 'origin' and 'destination'.",
        },
      });
    }

    const agentResult = await runDisasterAgent({
      query: effectiveQuery,
      origin,
      destination,
      disasterType,
      maxIterations,
      demoMode,
    });

    if (!agentResult.success && !agentResult.error) {
      agentResult.error = {
        code: "AGENT_PLANNING_FAILED",
        message: agentResult.summary || "Agent could not complete route planning. Please provide origin and destination.",
      };
    }

    return res.status(200).json(agentResult);
  } catch (error) {
    console.error("[AGENT-API] Error executing agent request:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "AGENT_EXECUTION_EXCEPTION",
        message: error.message || "An unexpected error occurred in agent execution.",
      },
    });
  }
};

router.post("/run", handleAgentRun);
router.post("/chat", handleAgentRun);

export default router;
