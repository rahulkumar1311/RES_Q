// RESQ Disaster Response Agent Orchestrator
// Implements autonomous multi-step plan-act-observe-decide workflow for emergency transit

import { createInitialAgentState, AGENT_STATUS, appendExecutionTrace, recordToolCall } from "./agentState.js";
import { defaultToolRegistry } from "./toolRegistry.js";
import "./tools/index.js"; // Ensure all 6 tools are registered
import { extractDisasterIntent, planNextAgentAction } from "./llmProvider.js";

const DEFAULT_MAX_STEPS = parseInt(process.env.MAX_AGENT_STEPS || "10", 10);

/**
 * Runs the RESQ Disaster Response Agent for a given emergency user query
 */
export async function runDisasterAgent({
  query = "",
  origin: explicitOrigin = null,
  destination: explicitDestination = null,
  disasterType: explicitDisaster = null,
  maxIterations = DEFAULT_MAX_STEPS,
  demoMode = false,
} = {}) {
  const state = createInitialAgentState(query, {
    origin: explicitOrigin,
    destination: explicitDestination,
    disasterType: explicitDisaster,
    maxIterations,
  });

  console.log(`[AGENT] Starting request ${state.requestId}: "${state.userRequest}"`);

  // Step 1: Intent & Parameter Extraction
  appendExecutionTrace(state, {
    step: "request_understood",
    message: `Request understood: "${state.userRequest || "Autonomous Safe Routing Request"}"`,
    status: "completed",
  });

  const intent = extractDisasterIntent(state.userRequest);
  if (!state.origin && intent.origin) state.origin = intent.origin;
  if (!state.destination && intent.destination) state.destination = intent.destination;
  if (intent.disasterType && (!state.disasterType || state.disasterType === "GENERAL_HAZARD")) {
    state.disasterType = intent.disasterType;
  }

  appendExecutionTrace(state, {
    step: "disaster_context_identified",
    message: `Disaster context identified: ${state.disasterType} (Origin: ${state.origin || "Not specified"}, Destination: ${state.destination || "Not specified"})`,
    status: "completed",
  });

  // Validation of mandatory transit locations
  if (!state.origin || !state.destination) {
    state.status = AGENT_STATUS.FAILED;
    appendExecutionTrace(state, {
      step: "validation_failed",
      message: "Could not extract both starting location and destination from request. Please specify origin and destination (e.g. 'from Guwahati to Shillong').",
      status: "failed",
    });
    return formatAgentResponse(state);
  }

  state.status = AGENT_STATUS.EXECUTING;

  // Step 2: Multi-Step Autonomous Execution Loop
  while (state.iterations < state.maxIterations && state.status !== AGENT_STATUS.COMPLETED && state.status !== AGENT_STATUS.FAILED) {
    state.iterations++;

    // Agent Planner decides next step based on state & tool observations
    const decision = await planNextAgentAction(state, defaultToolRegistry.listTools());

    if (decision.action === "FINALIZE") {
      state.status = AGENT_STATUS.COMPLETED;
      appendExecutionTrace(state, {
        step: "final_recommendation_formulated",
        message: "Final safe transit recommendation formulated with verified operational data.",
        status: "completed",
      });
      break;
    }

    if (decision.action === "CALL_TOOL") {
      const toolName = decision.tool;
      const inputs = decision.inputs || {};

      console.log(`[AGENT] Step ${state.iterations}: Calling tool '${toolName}'`);

      // Execute tool through controlled Tool Registry
      const toolResult = await defaultToolRegistry.executeTool(toolName, inputs, {
        requestId: state.requestId,
        demoMode,
      });

      // Record tool call
      recordToolCall(state, {
        tool: toolName,
        inputs,
        status: toolResult.success ? "completed" : "failed",
        summary: toolResult.success ? summarizeToolOutput(toolName, toolResult.data) : toolResult.error?.message,
        durationMs: toolResult.durationMs,
        error: toolResult.error,
        data: toolResult.data,
      });

      // Handle successful tool result & update operational state
      if (toolResult.success) {
        handleToolSuccess(state, toolName, toolResult.data);
      } else {
        handleToolFailure(state, toolName, toolResult.error);
      }
    }
  }

  // If loop exited without completion or failure, step limit was reached
  if (state.status !== AGENT_STATUS.COMPLETED && state.status !== AGENT_STATUS.FAILED) {
    state.status = AGENT_STATUS.FAILED;
    appendExecutionTrace(state, {
      step: "step_limit_reached",
      message: `Maximum agent execution step limit (${state.maxIterations}) reached. Halting workflow to prevent infinite loops.`,
      status: "failed",
    });
  }

  // Ensure state completed if we have candidate routes and wasn't marked failed
  if (state.status !== AGENT_STATUS.FAILED) {
    state.status = AGENT_STATUS.COMPLETED;
  }

  // Populate recommended route if not explicitly set
  if (!state.recommendedRoute && state.candidateRoutes.length > 0) {
    state.recommendedRoute = state.candidateRoutes[0];
  }

  state.completedAt = new Date().toISOString();
  console.log(`[AGENT] Completed request ${state.requestId} with status: ${state.status} in ${Date.now() - state.startTime}ms`);

  return formatAgentResponse(state);
}

/**
 * Summarizes tool outputs for UI execution logs
 */
function summarizeToolOutput(toolName, data) {
  if (!data) return "Executed successfully";
  switch (toolName) {
    case "calculate_route":
      return `Calculated route: ${data.distanceKm} km, ~${data.durationMinutes} mins (${data.instructionsCount || 0} maneuvers)`;
    case "get_hazard_data":
      return `Retrieved ${data.totalHazardsFound} hazard bulletins (${data.blockedRoadsCount} road closures, ${data.closedBridgesCount} bridge issues)`;
    case "query_risk_zones":
      return `Traversed ${data.totalGridsCrossed} 500m grid cells. Mean Risk: ${data.meanRiskScore}/100, Status: ${data.routeRiskStatus}`;
    case "check_route_safety":
      return `Safety Status: ${data.safetyStatus} (Risk: ${data.meanRiskScore}/100, Blocked: ${data.isBlocked ? "YES" : "NO"})`;
    case "find_alternative_route":
      return data.avoidanceSuccessful
        ? `Found alternative safe bypass route (${data.selectedRoute?.distanceKm} km, ${data.selectedRoute?.durationMinutes} mins)`
        : `Evaluated ${data.candidateCount} alternative branches: ${data.explanation}`;
    case "compare_routes":
      return `Compared ${data.comparisonCount} candidate corridors. Recommended Route #${(data.bestRouteIndex || 0) + 1}`;
    default:
      return "Tool completed successfully";
  }
}

/**
 * Processes successful tool results and transitions agent state
 */
function handleToolSuccess(state, toolName, data) {
  switch (toolName) {
    case "get_hazard_data": {
      state.hazards = data.hazards || [];
      appendExecutionTrace(state, {
        step: "hazard_data_retrieved",
        message: `Hazard data retrieved: ${data.totalHazardsFound} active incident(s) found near ${data.location?.name || "corridor"} (Source: ${data.dataSource})`,
        status: "completed",
      });
      break;
    }

    case "calculate_route": {
      state.candidateRoutes.push({
        id: "primary_route",
        name: "Primary Route",
        isPrimary: true,
        ...data,
      });
      appendExecutionTrace(state, {
        step: "route_calculated",
        message: `Route calculated: ${data.distanceKm} km, ~${data.durationMinutes} minutes via ${data.routingEngine || "RESQ router"}`,
        status: "completed",
      });
      break;
    }

    case "query_risk_zones": {
      appendExecutionTrace(state, {
        step: "risk_zones_queried",
        message: `Risk zones queried: Intersected ${data.totalGridsCrossed} 500m PostGIS grid cells (Mean Risk: ${data.meanRiskScore}/100, Status: ${data.routeRiskStatus})`,
        status: "completed",
      });
      break;
    }

    case "check_route_safety": {
      const isUnsafe = data.safetyStatus === "UNSAFE" || data.isBlocked || !data.isSafe;

      if (isUnsafe) {
        appendExecutionTrace(state, {
          step: "hazard_detected",
          message: `Hazard detected: ${data.reason}`,
          status: "warning",
        });
        appendExecutionTrace(state, {
          step: "replanning_initiated",
          message: "Re-planning initiated: Requesting alternative bypass route avoiding detected disaster hazard zones",
          status: "completed",
        });
      } else {
        appendExecutionTrace(state, {
          step: "route_safety_checked",
          message: `Route safety checked: ${data.reason}`,
          status: "completed",
        });
      }
      break;
    }

    case "find_alternative_route": {
      if (data.selectedRoute) {
        state.candidateRoutes.push({
          id: "alternative_route",
          name: "Safe Alternative Route",
          isAlternative: true,
          ...data.selectedRoute,
        });
      }
      appendExecutionTrace(state, {
        step: "alternative_route_evaluated",
        message: `Alternative route evaluated: ${data.explanation} (Avoidance: ${data.avoidanceSuccessful ? "Successful" : "Limited corridors"})`,
        status: "completed",
      });
      break;
    }

    case "compare_routes": {
      if (data.bestRoute) {
        state.recommendedRoute = data.bestRoute;
      }
      appendExecutionTrace(state, {
        step: "routes_compared",
        message: `Routes compared: ${data.recommendationSummary}`,
        status: "completed",
      });
      break;
    }
  }
}

/**
 * Handles graceful tool failure recovery
 */
function handleToolFailure(state, toolName, error) {
  const errMsg = error?.message || "Execution error";
  appendExecutionTrace(state, {
    step: `${toolName}_failed`,
    message: `Tool '${toolName}' encountered an issue: ${errMsg}. Engaging fallback recovery.`,
    status: "warning",
  });
  state.warnings.push(`Tool '${toolName}' warning: ${errMsg}`);
}

/**
 * Normalizes final agent response object for client consumption
 */
function formatAgentResponse(state) {
  const totalDurationMs = Date.now() - state.startTime;

  let summary = "";
  if (state.status === AGENT_STATUS.COMPLETED && state.recommendedRoute) {
    const route = state.recommendedRoute;
    const isSafe = !route.isBlocked && (route.meanRiskScore || 0) < 45;
    summary = `RESQ Agent completed safe transit planning for ${state.origin} to ${state.destination}. ` +
      `Recommended Route: ${route.distanceKm || "N/A"} km, ~${route.durationMinutes || "N/A"} mins. ` +
      `Corridor Risk Status: ${route.riskStatus || (isSafe ? "SAFE" : "CAUTION")}.`;
  } else if (state.status === AGENT_STATUS.FAILED) {
    summary = `RESQ Agent could not complete route planning: ${state.warnings[0] || "Incomplete route parameters."}`;
  } else {
    summary = "Planning completed.";
  }

  return {
    success: state.status === AGENT_STATUS.COMPLETED,
    requestId: state.requestId,
    status: state.status,
    request: state.userRequest,
    origin: state.origin,
    destination: state.destination,
    disasterType: state.disasterType,
    executionTrace: state.executionTrace,
    toolCalls: state.toolCalls,
    hazards: state.hazards,
    routes: state.candidateRoutes,
    recommendedRoute: state.recommendedRoute,
    warnings: state.warnings,
    summary,
    totalDurationMs,
  };
}
