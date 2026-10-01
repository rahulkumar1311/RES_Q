// Comprehensive Test Suite for AI-Powered Hazard Intelligence Pipeline
// Tests validation, confidence gating, error handling, audit trail, and routing eligibility

import assert from "assert";
import {
  processHazardPipeline,
  validateAiOutput,
  getConfidenceThreshold,
  getHazardAuditLogs,
  clearHazardAuditLogs,
} from "../services/snapdragon/aiHazardPipelineService.js";
import { loadModel } from "../services/snapdragon/snapdragonVisionService.js";

async function runTests() {
  console.log("================================================================================");
  console.log("            RESQ AI HAZARD INTELLIGENCE PIPELINE TEST SUITE                     ");
  console.log("================================================================================\n");

  clearHazardAuditLogs();

  // ---------------------------------------------------------------------------
  // TEST 1: Valid AI Result (High Confidence >= Threshold)
  // Must be marked is_ai_generated: true, eligible_for_routing: true, and approved
  // ---------------------------------------------------------------------------
  console.log("1. Testing Valid AI Result (High Confidence >= Threshold)...");
  const validFeatures = new Array(64).fill(0.0);
  for (let i = 0; i < 12; i++) validFeatures[i] = 2.5; // Trigger FLOOD class

  const validResult = await processHazardPipeline({
    features: validFeatures,
    locationText: "Boko Highway Sector, NH-27",
    district: "Kamrup",
    state: "Assam",
    confidenceThreshold: 0.70,
  });

  console.log(`   [VALID-AI] Hazard: ${validResult.hazard_type} | Conf: ${validResult.confidence} | Eligible: ${validResult.routing_integration?.eligible_for_routing}`);
  assert.strictEqual(validResult.success, true);
  assert.strictEqual(validResult.is_ai_generated, true);
  assert.strictEqual(validResult.hazard_type, "FLOOD");
  assert.ok(validResult.confidence >= 0.70, "Confidence must be >= 0.70");
  assert.strictEqual(validResult.routing_integration.eligible_for_routing, true);
  assert.strictEqual(validResult.routing_integration.status, "AUTO_APPROVED_AND_INTEGRATED");
  assert.strictEqual(validResult.passability.road_blocked, true);
  assert.ok(validResult.audit_id.startsWith("audit_hz_"));
  assert.ok(validResult.inference_time_ms >= 0);
  assert.ok(validResult.model_info.name.length > 0);
  console.log("   ✓ Valid High-Confidence AI Hazard successfully integrated into routing.\n");

  // ---------------------------------------------------------------------------
  // TEST 2: Low Confidence AI Result (< Threshold)
  // Must be flagged for human review, and NEVER automatically alter route!
  // ---------------------------------------------------------------------------
  console.log("2. Testing Low Confidence AI Result (Flagged for Review)...");
  const lowConfidenceSim = {
    hazard_type: "FLOOD",
    confidence: 0.52, // Below 0.70 threshold!
    severity: "MODERATE",
    severity_score: 42.0,
    affected_area: "12000m corridor buffer",
    source: "local_ai",
    inference_time_ms: 1.2,
    predicted_class: "FLOOD_WATER_SUBMERGENCE",
    display_name: "Flood Water Submergence",
    model_name: "MobileNetV3-Large-Disaster-Hazard",
    model_version: "v1.0-snapdragon",
    execution_provider: "cpu-fallback",
    fallback: false,
    passability: {
      status: "IMPASSABLE",
      road_blocked: true,
      bridge_closed: false,
      bridge_damaged: false,
    },
  };

  const lowConfResult = await processHazardPipeline({
    simulatedAiResult: lowConfidenceSim,
    locationText: "Dispur Outskirts",
    confidenceThreshold: 0.70,
  });

  console.log(`   [LOW-CONF] Hazard: ${lowConfResult.hazard_type} | Conf: ${lowConfResult.confidence} | Eligible: ${lowConfResult.routing_integration?.eligible_for_routing}`);
  assert.strictEqual(lowConfResult.success, true);
  assert.strictEqual(lowConfResult.is_ai_generated, true);
  assert.strictEqual(lowConfResult.confidence, 0.52);
  assert.strictEqual(lowConfResult.routing_integration.eligible_for_routing, false, "Low confidence prediction must NOT be eligible for automatic routing");
  assert.strictEqual(lowConfResult.routing_integration.status, "FLAGGED_FOR_REVIEW");
  assert.ok(lowConfResult.routing_integration.reason.includes("below required safety threshold"));
  console.log("   ✓ Low-Confidence AI prediction safely flagged for review with zero routing disruption.\n");

  // ---------------------------------------------------------------------------
  // TEST 3: Invalid AI Result (Validation Failure)
  // Must fail validation and reject from routing
  // ---------------------------------------------------------------------------
  console.log("3. Testing Invalid AI Result (Out-of-range confidence / invalid hazard)...");
  const invalidSim = {
    hazard_type: "NOT_A_REAL_HAZARD",
    confidence: 1.85, // Invalid confidence (> 1.0)
    severity_score: 150.0, // Invalid severity (> 100)
  };

  const invalidValidation = validateAiOutput(invalidSim);
  assert.strictEqual(invalidValidation.isValid, false);
  console.log(`   [VALIDATION-CHECK] Rejection Reason: "${invalidValidation.error}"`);

  const invalidPipelineRes = await processHazardPipeline({
    simulatedAiResult: invalidSim,
  });
  assert.strictEqual(invalidPipelineRes.success, false);
  assert.strictEqual(invalidPipelineRes.routing_integration.eligible_for_routing, false);
  assert.strictEqual(invalidPipelineRes.routing_integration.status, "VALIDATION_REJECTED");
  console.log("   ✓ Invalid AI output caught and rejected prior to routing.\n");

  // ---------------------------------------------------------------------------
  // TEST 4: Missing Model (Graceful Fallback)
  // ---------------------------------------------------------------------------
  console.log("4. Testing Missing Model Behavior (Graceful Degradation)...");
  loadModel("invalid/path/to/missing_model.json");

  const missingModelRes = await processHazardPipeline({
    features: validFeatures,
    locationText: "Corridor Test",
  });

  assert.strictEqual(missingModelRes.success, false);
  assert.strictEqual(missingModelRes.routing_integration.eligible_for_routing, false);
  assert.strictEqual(missingModelRes.hazard_type, "UNKNOWN");
  console.log(`   [MISSING-MODEL] Graceful degradation: Eligible=${missingModelRes.routing_integration.eligible_for_routing}`);
  console.log("   ✓ Missing model handled safely without crashing server.\n");

  // Restore model for subsequent tests
  loadModel();

  // ---------------------------------------------------------------------------
  // TEST 5: Inference Failure Handling
  // ---------------------------------------------------------------------------
  console.log("5. Testing Inference Failure Handling (Corrupted input)...");
  const corruptedRes = await processHazardPipeline({
    image: 12345, // Invalid non-string, non-buffer input
  });
  assert.strictEqual(corruptedRes.success, false);
  assert.strictEqual(corruptedRes.routing_integration.eligible_for_routing, false);
  assert.strictEqual(corruptedRes.routing_integration.status, "INFERENCE_FAILED");
  console.log(`   [INFERENCE-FAILURE] Handled safely: ${corruptedRes.error}`);
  console.log("   ✓ Inference failure trapped gracefully.\n");

  // ---------------------------------------------------------------------------
  // TEST 6: Normal Existing Hazard Flow (Manual Operator Ingestion)
  // Preserves 100% of RESQ's existing manual intake
  // ---------------------------------------------------------------------------
  console.log("6. Testing Normal Existing Hazard Flow (Manual Operator Report)...");
  const manualReport = {
    eventType: "BRIDGE_DAMAGE",
    hazardType: "STRUCTURAL",
    severity: 90.0,
    locationText: "Nongpoh Bridge, GS Road",
    district: "Ri-Bhoi",
    state: "Meghalaya",
    roadBlocked: true,
    bridgeClosed: true,
    bridgeDamaged: true,
  };

  const manualRes = await processHazardPipeline({
    manualPayload: manualReport,
  });

  console.log(`   [MANUAL-FLOW] Hazard: ${manualRes.hazard_type} | Source: ${manualRes.source} | is_ai: ${manualRes.is_ai_generated}`);
  assert.strictEqual(manualRes.is_ai_generated, false, "Manual hazard must NOT be flagged as AI");
  assert.strictEqual(manualRes.source, "manual_operator");
  assert.strictEqual(manualRes.hazard_type, "STRUCTURAL");
  assert.strictEqual(manualRes.event_type, "BRIDGE_DAMAGE");
  assert.strictEqual(manualRes.confidence, 1.0);
  assert.strictEqual(manualRes.passability.bridge_closed, true);
  assert.strictEqual(manualRes.routing_integration.eligible_for_routing, true);
  assert.strictEqual(manualRes.routing_integration.status, "MANUAL_OPERATOR_VERIFIED");
  console.log("   ✓ Existing manual hazard intake operating normally without AI interference.\n");

  // ---------------------------------------------------------------------------
  // TEST 7: Audit Log Verification
  // ---------------------------------------------------------------------------
  console.log("7. Verifying Audit Log Integrity...");
  const logs = getHazardAuditLogs();
  console.log(`   Audit Records Captured: ${logs.length}`);
  assert.ok(logs.length >= 6, "Must have recorded audit entries for all test actions");

  const latestLog = logs[0];
  assert.ok(latestLog.auditId.startsWith("audit_hz_"));
  assert.ok(typeof latestLog.timestamp === "string");
  assert.ok(typeof latestLog.latencyMs === "number");
  console.log(`   ✓ Audit Trail OK: ID ${latestLog.auditId} (${latestLog.type} -> ${latestLog.decision})\n`);

  console.log("================================================================================");
  console.log("        ALL AI HAZARD PIPELINE INTEGRATION TESTS PASSED (100% OK)               ");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("❌ Test Suite Failed:", err);
  process.exit(1);
});
