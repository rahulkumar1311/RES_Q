// AI-Powered Hazard Intelligence Pipeline Service
// Coordinates on-device AI inference, confidence validation, safety floor escalation,
// PostGIS hazard storage, and dynamic reroute evaluation with zero routing disruption.

import pool from "../../config/db.js";
import { performance } from "perf_hooks";
import SNAPDRAGON_CONFIG from "./snapdragonConfig.js";
import { classifyHazard, getModelStatus } from "./snapdragonVisionService.js";
import { evaluateGridRiskUpdate, executeDynamicReroute } from "../routing/routeMonitorService.js";
import { findAffectedGridCells } from "../news/newsGeolocationService.js";
import { REGIONAL_ZONES } from "../risk/regionalIntelligenceStore.js";
import { detectHardware, resolveExecutionBackend } from "./snapdragonOptimizer.js";

// In-Memory Audit Trail for AI Hazard Predictions & Safety Decisions
const hazardAuditLogs = [];
const MAX_AUDIT_LOGS = 250;

// Configurable Confidence Threshold (Default: 0.70)
export function getConfidenceThreshold(customThreshold = null) {
  if (typeof customThreshold === "number" && !isNaN(customThreshold)) {
    return Math.min(1.0, Math.max(0.0, customThreshold));
  }
  const envThreshold = parseFloat(process.env.SNAPDRAGON_HAZARD_CONFIDENCE_THRESHOLD);
  if (!isNaN(envThreshold)) {
    return envThreshold;
  }
  return SNAPDRAGON_CONFIG.CONFIDENCE_THRESHOLD || 0.70;
}

/**
 * Validates the raw structural integrity of AI inference output before downstream consumption
 * @param {object} aiResult - Output from classifyHazard
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateAiOutput(aiResult) {
  if (!aiResult || typeof aiResult !== "object") {
    return { isValid: false, error: "AI result must be a non-null object" };
  }

  if (aiResult.fallback === true && aiResult.hazard_type === "UNKNOWN") {
    return { isValid: false, error: aiResult.error || "Model returned fallback state" };
  }

  if (!aiResult.hazard_type || typeof aiResult.hazard_type !== "string") {
    return { isValid: false, error: "Missing or invalid 'hazard_type' string" };
  }

  if (typeof aiResult.confidence !== "number" || isNaN(aiResult.confidence) || aiResult.confidence < 0 || aiResult.confidence > 1.0) {
    return { isValid: false, error: `Invalid confidence score: ${aiResult.confidence} (must be float in [0.0, 1.0])` };
  }

  if (typeof aiResult.severity_score !== "number" || isNaN(aiResult.severity_score) || aiResult.severity_score < 0 || aiResult.severity_score > 100) {
    return { isValid: false, error: `Invalid severity score: ${aiResult.severity_score} (must be in [0, 100])` };
  }

  const validHazards = ["FLOOD", "STRUCTURAL", "LANDSLIDE", "INFRASTRUCTURE", "NONE", "GENERAL"];
  if (!validHazards.includes(aiResult.hazard_type.toUpperCase())) {
    return { isValid: false, error: `Unrecognized hazard_type: ${aiResult.hazard_type}` };
  }

  return { isValid: true };
}

/**
 * Main AI-Assisted Hazard Interpretation & Routing Integration Pipeline
 * 
 * Flow:
 * Hazard Input -> Local AI -> Hazard Intelligence -> Validation -> Confidence Gating ->
 * RESQ Hazard Storage -> Route Corridor Risk Evaluation -> Live Convoy Rerouting
 * 
 * @param {object} params - Input parameters
 * @returns {Promise<object>} Structured hazard response
 */
export async function processHazardPipeline({
  image = null,
  features = null,
  manualPayload = null,
  locationText = "Field Corridor Survey",
  district = "Kamrup Metropolitan",
  state = "Assam",
  latitude = 26.1445,
  longitude = 91.7362,
  confidenceThreshold = null,
  simulatedAiResult = null, // For testing specific AI states directly
  sourceAttribution = null, // 'ai' | 'manual' | 'external'
  autoReroute = false, // Automatically trigger executeDynamicReroute if session affected
  rerouteSessionId = null, // Target session ID to reroute
  targetGridIds = null, // Optional explicit 500m grid cell IDs for targeted corridor evaluation
}) {
  const pipelineStartTime = performance.now();
  const threshold = getConfidenceThreshold(confidenceThreshold);
  const auditId = `audit_hz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const effectiveSource = (sourceAttribution || (manualPayload ? "manual" : "ai")).toLowerCase();

  // ===========================================================================
  // BRANCH 1: NORMAL EXISTING MANUAL HAZARD FLOW (No AI)
  // If caller provided purely a manual report without image or features,
  // execute standard RESQ hazard ingestion with zero AI interference.
  // ===========================================================================
  if (!image && !features && !simulatedAiResult && manualPayload) {
    const manualResult = {
      audit_id: auditId,
      is_ai_generated: false,
      source: effectiveSource === "external" ? "external_feed" : "manual_operator",
      source_attribution: effectiveSource,
      device: detectHardware().device,
      processor: detectHardware().processor,
      ai_backend: "manual-entry",
      model: "Manual-Operator",
      precision: "N/A",
      inference_time: 0.0,
      hazard_type: manualPayload.hazardType || "GENERAL_HAZARD",
      event_type: manualPayload.eventType || "ROAD_BLOCKAGE",
      confidence: 1.0,
      severity: manualPayload.severity || 75.0,
      severity_score: parseFloat(manualPayload.severity) || 75.0,
      affected_area: "Standard 5000m buffer",
      ai_inference_time_ms: 0.0,
      route_decision: "MANUAL_VERIFIED",
      rerouting_time_ms: 0.0,
      location: {
        text: manualPayload.locationText || locationText,
        district: manualPayload.district || district,
        state: manualPayload.state || state,
        latitude: parseFloat(manualPayload.latitude ?? latitude),
        longitude: parseFloat(manualPayload.longitude ?? longitude),
      },
      passability: {
        road_blocked: Boolean(manualPayload.roadBlocked),
        bridge_closed: Boolean(manualPayload.bridgeClosed),
        bridge_damaged: Boolean(manualPayload.bridgeDamaged),
        status: manualPayload.roadBlocked ? "IMPASSABLE" : "PASSABLE_WITH_CAUTION",
      },
      routing_integration: {
        eligible_for_routing: true,
        status: "MANUAL_OPERATOR_VERIFIED",
        action_taken: "INTEGRATED_INTO_ROUTING",
      },
      pipeline_latency_ms: Math.round((performance.now() - pipelineStartTime) * 100) / 100,
    };

    // Optional manual dynamic rerouting integration
    let reroutingTimeMs = 0.0;
    let routeDecision = "MANUAL_VERIFIED";
    let rerouteResult = null;
    let affectedSessionsCount = 0;
    let rerouteTriggered = false;
    const triggeredSessionIds = new Set();

    if (autoReroute || rerouteSessionId || targetGridIds) {
      let affectedCells = [];
      if (Array.isArray(targetGridIds) && targetGridIds.length > 0) {
        affectedCells = targetGridIds.map((gid) => ({ grid_id: gid, state, district }));
      } else {
        const bufferMeters = (manualPayload.hazardType || "").toUpperCase() === "FLOOD" ? 12000 : 6000;
        try {
          affectedCells = await findAffectedGridCells(manualResult.location.latitude, manualResult.location.longitude, bufferMeters, manualResult.location.state);
        } catch (_) {}
      }

      for (const cell of (affectedCells || []).slice(0, 20)) {
        try {
          const riskUpdates = await evaluateGridRiskUpdate(cell.grid_id, {
            riskScore: manualResult.severity_score,
            riskStatus: manualResult.severity,
            roadClosureRisk: manualResult.passability.road_blocked ? 90.0 : manualResult.severity_score,
          });
          if (Array.isArray(riskUpdates) && riskUpdates.length > 0) {
            affectedSessionsCount += riskUpdates.length;
            for (const upd of riskUpdates) {
              if (upd.requiresReroute) {
                rerouteTriggered = true;
                triggeredSessionIds.add(upd.sessionId);
              }
            }
          }
        } catch (_) {}
      }

      if (rerouteTriggered) {
        routeDecision = "REROUTE_TRIGGERED";
        const targetId = rerouteSessionId || Array.from(triggeredSessionIds)[0];
        if (autoReroute && targetId) {
          const rerouteStart = performance.now();
          try {
            rerouteResult = await executeDynamicReroute(targetId);
            reroutingTimeMs = Math.round((performance.now() - rerouteStart) * 100) / 100;
            routeDecision = rerouteResult?.success ? "REROUTE_EXECUTED" : "REROUTE_FAILED";
          } catch (err) {
            reroutingTimeMs = Math.round((performance.now() - rerouteStart) * 100) / 100;
            routeDecision = "REROUTE_ERROR";
            rerouteResult = { success: false, error: err.message };
          }
        }
      }
    }

    manualResult.route_decision = routeDecision;
    manualResult.rerouting_time_ms = reroutingTimeMs;
    if (rerouteResult) {
      manualResult.reroute_result = rerouteResult;
      manualResult.routing_integration.reroute_result = rerouteResult;
    }

    console.log(
      `[RESQ-HAZARD-INTELLIGENCE] Source: ${effectiveSource.toUpperCase()} | ` +
      `Hazard: ${manualResult.hazard_type} | ` +
      `Confidence: 100.0% | ` +
      `Severity: ${manualResult.severity} | ` +
      `AI Inference: 0.0 ms | ` +
      `Route Decision: ${routeDecision} | ` +
      `Reroute Time: ${reroutingTimeMs} ms`
    );

    recordAuditLog({
      auditId,
      type: "MANUAL_HAZARD",
      isAi: false,
      source_attribution: effectiveSource,
      hazard_type: manualResult.hazard_type,
      confidence: 1.0,
      severity: manualResult.severity,
      severity_score: manualResult.severity_score,
      ai_inference_time_ms: 0.0,
      route_decision: routeDecision,
      rerouting_time_ms: reroutingTimeMs,
      threshold,
      eligibleForRouting: true,
      decision: routeDecision,
      latencyMs: manualResult.pipeline_latency_ms,
    });

    return manualResult;
  }

  // ===========================================================================
  // BRANCH 2: LOCAL AI INFERENCE & HAZARD INTERPRETATION
  // ===========================================================================
  let aiResult;
  if (simulatedAiResult) {
    aiResult = simulatedAiResult;
  } else {
    try {
      const aiInput = features ? { features } : image;
      aiResult = classifyHazard(aiInput, { district, state });
    } catch (inferErr) {
      console.error("[AI-HAZARD-PIPELINE] Local AI inference error:", inferErr.message);
      const latency = Math.round((performance.now() - pipelineStartTime) * 100) / 100;
      const failureResponse = {
        audit_id: auditId,
        success: false,
        is_ai_generated: effectiveSource === "ai",
        source: effectiveSource === "ai" ? "local_ai" : (effectiveSource === "external" ? "external_feed" : "manual_operator"),
        source_attribution: effectiveSource,
        hazard_type: "UNKNOWN",
        confidence: 0.0,
        severity: "UNKNOWN",
        severity_score: 0.0,
        affected_area: "0m",
        ai_inference_time_ms: 0.0,
        route_decision: "ERROR_REJECTED",
        rerouting_time_ms: 0.0,
        error: `Inference execution failed: ${inferErr.message}`,
        routing_integration: {
          eligible_for_routing: false,
          status: "INFERENCE_FAILED",
          route_decision: "ERROR_REJECTED",
          rerouting_time_ms: 0.0,
          reason: "Local AI inference failed. Hazard rejected from automatic routing.",
        },
        pipeline_latency_ms: latency,
      };

      recordAuditLog({
        auditId,
        type: "AI_INFERENCE_FAILURE",
        isAi: effectiveSource === "ai",
        source_attribution: effectiveSource,
        hazard_type: "UNKNOWN",
        confidence: 0.0,
        severity: "UNKNOWN",
        severity_score: 0.0,
        ai_inference_time_ms: 0.0,
        route_decision: "ERROR_REJECTED",
        rerouting_time_ms: 0.0,
        threshold,
        eligibleForRouting: false,
        decision: "ERROR_REJECTED",
        latencyMs: latency,
        error: inferErr.message,
      });

      return failureResponse;
    }
  }

  // Check if AI result indicates an internal inference failure or fallback state
  if (aiResult?.fallback === true) {
    const latency = Math.round((performance.now() - pipelineStartTime) * 100) / 100;
    const errorMsg = aiResult.error || "Model returned fallback state";
    const failureResponse = {
      audit_id: auditId,
      success: false,
      is_ai_generated: effectiveSource === "ai",
      source: effectiveSource === "ai" ? "local_ai" : (effectiveSource === "external" ? "external_feed" : "manual_operator"),
      source_attribution: effectiveSource,
      hazard_type: "UNKNOWN",
      confidence: 0.0,
      severity: "UNKNOWN",
      severity_score: 0.0,
      affected_area: "0m",
      ai_inference_time_ms: 0.0,
      route_decision: "ERROR_REJECTED",
      rerouting_time_ms: 0.0,
      error: `Inference execution failed: ${errorMsg}`,
      routing_integration: {
        eligible_for_routing: false,
        status: "INFERENCE_FAILED",
        route_decision: "ERROR_REJECTED",
        rerouting_time_ms: 0.0,
        reason: errorMsg,
      },
      pipeline_latency_ms: latency,
    };

    recordAuditLog({
      auditId,
      type: "AI_INFERENCE_FAILURE",
      isAi: effectiveSource === "ai",
      source_attribution: effectiveSource,
      hazard_type: "UNKNOWN",
      confidence: 0.0,
      severity: "UNKNOWN",
      severity_score: 0.0,
      ai_inference_time_ms: 0.0,
      route_decision: "ERROR_REJECTED",
      rerouting_time_ms: 0.0,
      threshold,
      eligibleForRouting: false,
      decision: "ERROR_REJECTED",
      latencyMs: latency,
      error: errorMsg,
    });

    return failureResponse;
  }

  // ===========================================================================
  // STEP 3: VALIDATE AI OUTPUT STRUCTURE
  // ===========================================================================
  const validation = validateAiOutput(aiResult);
  if (!validation.isValid) {
    const latency = Math.round((performance.now() - pipelineStartTime) * 100) / 100;
    const invalidResponse = {
      audit_id: auditId,
      success: false,
      is_ai_generated: effectiveSource === "ai",
      source: effectiveSource === "ai" ? "local_ai" : (effectiveSource === "external" ? "external_feed" : "manual_operator"),
      source_attribution: effectiveSource,
      hazard_type: aiResult?.hazard_type || "INVALID",
      confidence: typeof aiResult?.confidence === "number" ? aiResult.confidence : 0.0,
      severity: "INVALID",
      severity_score: 0.0,
      affected_area: "0m",
      ai_inference_time_ms: 0.0,
      route_decision: "VALIDATION_FAILED",
      rerouting_time_ms: 0.0,
      error: `Validation failed: ${validation.error}`,
      routing_integration: {
        eligible_for_routing: false,
        status: "VALIDATION_REJECTED",
        route_decision: "VALIDATION_FAILED",
        rerouting_time_ms: 0.0,
        reason: validation.error,
      },
      pipeline_latency_ms: latency,
    };

    recordAuditLog({
      auditId,
      type: "AI_VALIDATION_FAILURE",
      isAi: effectiveSource === "ai",
      source_attribution: effectiveSource,
      hazard_type: invalidResponse.hazard_type,
      confidence: invalidResponse.confidence,
      severity: "INVALID",
      severity_score: 0.0,
      ai_inference_time_ms: 0.0,
      route_decision: "VALIDATION_FAILED",
      rerouting_time_ms: 0.0,
      threshold,
      eligibleForRouting: false,
      decision: "VALIDATION_FAILED",
      latencyMs: latency,
      error: validation.error,
    });

    return invalidResponse;
  }

  // ===========================================================================
  // STEP 4: CONFIDENCE THRESHOLD GATING
  // Never automatically trust low-confidence AI predictions for relief routing
  // ===========================================================================
  const aiConfidence = aiResult.confidence;
  const isHighConfidence = aiConfidence >= threshold;

  // Build baseline structured payload conforming to RESQ
  const baseResponse = {
    audit_id: auditId,
    success: true,
    is_ai_generated: effectiveSource === "ai",
    source: effectiveSource === "ai" ? "local_ai" : (effectiveSource === "external" ? "external_feed" : "manual_operator"),
    source_attribution: effectiveSource,
    device: aiResult.device || detectHardware().device,
    processor: aiResult.processor || detectHardware().processor,
    ai_backend: aiResult.ai_backend || resolveExecutionBackend().backend,
    model: aiResult.model || aiResult.model_name || SNAPDRAGON_CONFIG.MODEL_NAME,
    precision: aiResult.precision || resolveExecutionBackend().precision,
    inference_time: aiResult.inference_time ?? (aiResult.inference_time_ms || 0.0),
    hazard_type: aiResult.hazard_type,
    event_type: aiResult.event_type || "ROAD_BLOCKAGE",
    predicted_class: aiResult.predicted_class || "UNKNOWN",
    display_name: aiResult.display_name || aiResult.hazard_type,
    confidence: aiConfidence,
    confidence_threshold: threshold,
    severity: aiResult.severity,
    severity_score: aiResult.severity_score || 0.0,
    affected_area: aiResult.affected_area || "5000m corridor buffer",
    inference_time_ms: aiResult.inference_time_ms || 0.0,
    ai_inference_time_ms: aiResult.inference_time_ms || 0.0,
    route_decision: "PENDING_EVALUATION",
    rerouting_time_ms: 0.0,
    model_info: {
      name: aiResult.model_name || SNAPDRAGON_CONFIG.MODEL_NAME,
      version: aiResult.model_version || SNAPDRAGON_CONFIG.MODEL_VERSION,
      execution_provider: aiResult.execution_provider || "cpu-fallback",
      target_hardware: aiResult.target_hardware || SNAPDRAGON_CONFIG.TARGET_HARDWARE,
    },
    location: {
      text: locationText,
      district,
      state,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    },
    passability: {
      status: aiResult.passability?.status || "CAUTION",
      road_blocked: Boolean(aiResult.passability?.road_blocked),
      bridge_closed: Boolean(aiResult.passability?.bridge_closed),
      bridge_damaged: Boolean(aiResult.passability?.bridge_damaged),
    },
  };

  // Case A: Low Confidence (< threshold) -> Flag for operator review, reject from routing
  if (!isHighConfidence) {
    const latency = Math.round((performance.now() - pipelineStartTime) * 100) / 100;
    baseResponse.route_decision = "FLAGGED_FOR_REVIEW_NO_REROUTE";
    baseResponse.rerouting_time_ms = 0.0;
    baseResponse.routing_integration = {
      eligible_for_routing: false,
      status: "FLAGGED_FOR_REVIEW",
      route_decision: "FLAGGED_FOR_REVIEW_NO_REROUTE",
      rerouting_time_ms: 0.0,
      reason: `Confidence (${aiConfidence.toFixed(2)}) is below required safety threshold (${threshold.toFixed(2)}). Flagged for human review; not routed automatically.`,
      action_taken: "STORED_FOR_REVIEW_NO_REROUTE",
    };
    baseResponse.pipeline_latency_ms = latency;

    console.log(
      `[RESQ-HAZARD-INTELLIGENCE] Source: ${effectiveSource.toUpperCase()} | ` +
      `Hazard: ${baseResponse.hazard_type} | ` +
      `Confidence: ${(baseResponse.confidence * 100).toFixed(1)}% | ` +
      `Severity: ${baseResponse.severity} | ` +
      `AI Inference: ${baseResponse.ai_inference_time_ms} ms | ` +
      `Route Decision: FLAGGED_FOR_REVIEW_NO_REROUTE | ` +
      `Reroute Time: 0.0 ms`
    );

    recordAuditLog({
      auditId,
      type: "AI_HAZARD_EVALUATION",
      isAi: effectiveSource === "ai",
      source_attribution: effectiveSource,
      hazard_type: aiResult.hazard_type,
      confidence: aiConfidence,
      severity: aiResult.severity,
      severity_score: aiResult.severity_score || 0.0,
      ai_inference_time_ms: baseResponse.ai_inference_time_ms,
      route_decision: "FLAGGED_FOR_REVIEW_NO_REROUTE",
      rerouting_time_ms: 0.0,
      threshold,
      eligibleForRouting: false,
      decision: "FLAGGED_FOR_REVIEW",
      latencyMs: latency,
    });

    return baseResponse;
  }

  // ===========================================================================
  // STEP 5: ELIGIBLE FOR ROUTING (Confidence >= threshold)
  // Integrate into RESQ Hazard System & Route Risk Evaluator
  // ===========================================================================
  const latency = Math.round((performance.now() - pipelineStartTime) * 100) / 100;
  baseResponse.pipeline_latency_ms = latency;

  // 5.1 Store in disaster.news_events (PostGIS) with clear AI metadata
  let dbEventId = null;
  try {
    const client = await pool.connect();
    try {
      const insertSql = `
        INSERT INTO disaster.news_events (
          event_type, hazard_type, severity, confidence, location_text,
          district, state, latitude, longitude, geom,
          road_blocked, bridge_damaged, bridge_closed, reported_at, event_status,
          raw_extraction
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, ST_SetSRID(ST_MakePoint($9, $8), 4326),
          $10, $11, $12, NOW(), 'ACTIVE',
          $13
        ) RETURNING id;
      `;
      const res = await client.query(insertSql, [
        baseResponse.event_type,
        baseResponse.hazard_type,
        baseResponse.severity_score,
        baseResponse.confidence,
        baseResponse.location.text,
        district,
        state,
        latitude,
        longitude,
        baseResponse.passability.road_blocked,
        baseResponse.passability.bridge_damaged,
        baseResponse.passability.bridge_closed,
        JSON.stringify({
          source: effectiveSource === "external" ? "external_feed" : "snapdragon_local_ai",
          source_attribution: effectiveSource,
          audit_id: auditId,
          model: baseResponse.model_info,
          passability: baseResponse.passability,
        }),
      ]);
      if (res.rows.length > 0) {
        dbEventId = res.rows[0].id;
      }
    } finally {
      client.release();
    }
  } catch (dbErr) {
    // Database fallback
  }

  // 5.2 Find Affected 500m Grid Cells (Preserve Existing Hazard Radius Logic)
  // Floods: 12km buffer; Landslides: 5km buffer; Structural/Roads: 6km buffer
  let affectedCells = [];
  const hazardUpper = (baseResponse.hazard_type || "").toUpperCase();
  const bufferMeters = hazardUpper === "FLOOD" ? 12000 : (hazardUpper === "LANDSLIDE" ? 5000 : 6000);

  if (Array.isArray(targetGridIds) && targetGridIds.length > 0) {
    affectedCells = targetGridIds.map((gid) => ({ grid_id: gid, state, district }));
  } else {
    try {
      affectedCells = await findAffectedGridCells(latitude, longitude, bufferMeters, state);
    } catch (gridErr) {
      // Fallback: match nearest regional strategic zone
      const matchedZone = REGIONAL_ZONES.find((z) => z.state.toLowerCase() === state.toLowerCase()) || REGIONAL_ZONES[0];
      if (matchedZone) {
        affectedCells = [{ grid_id: matchedZone.gridId, state: matchedZone.state, district: matchedZone.district }];
      }
    }

    if (!affectedCells || affectedCells.length === 0) {
      const matchedZone = REGIONAL_ZONES.find((z) => z.state.toLowerCase() === state.toLowerCase()) || REGIONAL_ZONES[0];
      if (matchedZone) {
        affectedCells = [{ grid_id: matchedZone.gridId, state: matchedZone.state, district: matchedZone.district }];
      }
    }
  }

  // 5.3 Dispatch Dynamic Risk Updates to Active Navigation Sessions (Existing RESQ Risk Evaluator)
  let affectedSessionsCount = 0;
  let rerouteTriggered = false;
  const triggeredSessionIds = new Set();
  const allAffectedUpdates = [];

  for (const cell of (affectedCells || []).slice(0, 20)) {
    try {
      const riskUpdates = await evaluateGridRiskUpdate(cell.grid_id, {
        riskScore: baseResponse.severity_score,
        riskStatus: baseResponse.severity,
        roadClosureRisk: baseResponse.passability.road_blocked ? 90.0 : baseResponse.severity_score,
      });

      if (Array.isArray(riskUpdates) && riskUpdates.length > 0) {
        affectedSessionsCount += riskUpdates.length;
        for (const upd of riskUpdates) {
          allAffectedUpdates.push(upd);
          if (upd.requiresReroute) {
            rerouteTriggered = true;
            triggeredSessionIds.add(upd.sessionId);
          }
        }
      }
    } catch (e) {
      // Non-blocking for offline safety
    }
  }

  // 5.4 RESQ Dynamic Rerouting Execution (Safe Route Generation)
  let reroutingTimeMs = 0.0;
  let routeDecision = "NO_REROUTE_NEEDED";
  let rerouteResult = null;

  if (rerouteTriggered) {
    routeDecision = "REROUTE_TRIGGERED";
    const targetId = rerouteSessionId || Array.from(triggeredSessionIds)[0];

    if (autoReroute && targetId) {
      const rerouteStart = performance.now();
      try {
        rerouteResult = await executeDynamicReroute(targetId);
        reroutingTimeMs = Math.round((performance.now() - rerouteStart) * 100) / 100;
        if (rerouteResult?.success) {
          routeDecision = "REROUTE_EXECUTED";
        } else {
          routeDecision = "REROUTE_FAILED";
        }
      } catch (err) {
        reroutingTimeMs = Math.round((performance.now() - rerouteStart) * 100) / 100;
        routeDecision = "REROUTE_ERROR";
        rerouteResult = { success: false, error: err.message };
      }
    }
  }

  baseResponse.route_decision = routeDecision;
  baseResponse.rerouting_time_ms = reroutingTimeMs;
  if (rerouteResult) {
    baseResponse.reroute_result = rerouteResult;
  }

  baseResponse.routing_integration = {
    eligible_for_routing: true,
    status: "AUTO_APPROVED_AND_INTEGRATED",
    event_id: dbEventId,
    affected_cells_count: affectedCells.length,
    affected_sessions_count: affectedSessionsCount,
    reroute_triggered: rerouteTriggered,
    route_decision: routeDecision,
    rerouting_time_ms: reroutingTimeMs,
    action_taken: rerouteTriggered
      ? (routeDecision === "REROUTE_EXECUTED" ? "ROAD_CLOSURE_VETO_APPLIED_CONVOY_REROUTED" : "REROUTE_FLAGGED_FOR_CONVOY")
      : "GRID_HAZARD_UPDATED_NO_CONVOYS_PRESENT",
    reroute_result: rerouteResult,
  };

  console.log(
    `[RESQ-HAZARD-INTELLIGENCE] Source: ${effectiveSource.toUpperCase()} | ` +
    `Hazard: ${baseResponse.hazard_type} | ` +
    `Confidence: ${(baseResponse.confidence * 100).toFixed(1)}% | ` +
    `Severity: ${baseResponse.severity} (${baseResponse.severity_score}) | ` +
    `AI Inference: ${baseResponse.ai_inference_time_ms} ms | ` +
    `Route Decision: ${routeDecision} | ` +
    `Reroute Time: ${reroutingTimeMs} ms`
  );

  recordAuditLog({
    auditId,
    type: "AI_HAZARD_EVALUATION",
    isAi: effectiveSource === "ai",
    source_attribution: effectiveSource,
    hazard_type: baseResponse.hazard_type,
    confidence: aiConfidence,
    severity: baseResponse.severity,
    severity_score: baseResponse.severity_score,
    ai_inference_time_ms: baseResponse.ai_inference_time_ms,
    route_decision: routeDecision,
    rerouting_time_ms: reroutingTimeMs,
    threshold,
    eligibleForRouting: true,
    decision: routeDecision,
    affectedSessions: affectedSessionsCount,
    latencyMs: latency,
  });

  return baseResponse;
}

/**
 * Internal Audit Logger
 */
function recordAuditLog(logEntry) {
  hazardAuditLogs.unshift({
    ...logEntry,
    timestamp: new Date().toISOString(),
  });
  if (hazardAuditLogs.length > MAX_AUDIT_LOGS) {
    hazardAuditLogs.pop();
  }
}

/**
 * Returns recent audit records for transparency and auditing
 */
export function getHazardAuditLogs(limit = 50) {
  return hazardAuditLogs.slice(0, limit);
}

/**
 * Clears audit logs (useful for unit test isolation)
 */
export function clearHazardAuditLogs() {
  hazardAuditLogs.length = 0;
}

export default {
  getConfidenceThreshold,
  validateAiOutput,
  processHazardPipeline,
  getHazardAuditLogs,
  clearHazardAuditLogs,
};
