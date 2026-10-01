// Test Suite for STEP 6: RESQ Local/Offline AI Mode
// Validates:
// 1. AI_MODE=local configuration and zero cloud AI API dependency
// 2. Local model artifact verification
// 3. System status string: LOCAL AI: READY or LOCAL AI: UNAVAILABLE
// 4. Separation of on-device AI capability vs internet-dependent routing/data services
// 5. Graceful fallback to existing manual workflow when model is unavailable
// 6. Real local mathematical inference without fabricated results

import assert from "assert";
import fs from "fs";
import SNAPDRAGON_CONFIG from "../services/snapdragon/snapdragonConfig.js";
import {
  loadModel,
  getModelStatus,
  classifyHazard,
} from "../services/snapdragon/snapdragonVisionService.js";
import { processHazardPipeline } from "../services/snapdragon/aiHazardPipelineService.js";

async function runOfflineAiTests() {
  console.log("================================================================================");
  console.log("             RESQ STEP 6: LOCAL / OFFLINE AI MODE TEST SUITE                    ");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: Configuration Verification (AI_MODE=local)
  // ---------------------------------------------------------------------------
  console.log("1. Verifying Local AI Configuration & Safety Invariants...");
  console.log(`   Configured AI_MODE: ${SNAPDRAGON_CONFIG.AI_MODE}`);
  console.log(`   Allow Cloud AI Fallback: ${SNAPDRAGON_CONFIG.ALLOW_CLOUD_AI_FALLBACK}`);
  console.log(`   Offline Capable: ${SNAPDRAGON_CONFIG.OFFLINE_CAPABLE}`);
  console.log(`   Fallback to Manual: ${SNAPDRAGON_CONFIG.FALLBACK_TO_MANUAL}`);

  assert.strictEqual(SNAPDRAGON_CONFIG.AI_MODE, "local", "AI_MODE must be configured as 'local'");
  assert.strictEqual(SNAPDRAGON_CONFIG.ALLOW_CLOUD_AI_FALLBACK, false, "Must not allow cloud AI API fallback for user data");
  assert.strictEqual(SNAPDRAGON_CONFIG.OFFLINE_CAPABLE, true, "Local AI module must be flagged offline capable");
  assert.strictEqual(SNAPDRAGON_CONFIG.FALLBACK_TO_MANUAL, true, "System must permit manual fallback if local model fails");
  console.log("   ✓ Configuration invariant checks PASSED.\n");

  // ---------------------------------------------------------------------------
  // TEST 2: Local Model Storage Verification
  // Model weights and classification ontology must be stored on local filesystem
  // ---------------------------------------------------------------------------
  console.log("2. Verifying Local Model Artifact Storage...");
  console.log(`   Model Path: ${SNAPDRAGON_CONFIG.MODEL_PATH}`);
  console.log(`   Classes Path: ${SNAPDRAGON_CONFIG.CLASSES_PATH}`);

  assert.ok(fs.existsSync(SNAPDRAGON_CONFIG.MODEL_PATH), "Model JSON artifact must exist locally");
  assert.ok(fs.existsSync(SNAPDRAGON_CONFIG.CLASSES_PATH), "Hazard classes JSON must exist locally");

  const modelStat = fs.statSync(SNAPDRAGON_CONFIG.MODEL_PATH);
  const classesStat = fs.statSync(SNAPDRAGON_CONFIG.CLASSES_PATH);
  console.log(`   Model Artifact Size: ${(modelStat.size / 1024).toFixed(1)} KB`);
  console.log(`   Classes File Size: ${(classesStat.size / 1024).toFixed(1)} KB`);
  assert.ok(modelStat.size > 100, "Model file must contain valid payload");
  console.log("   ✓ Local model artifacts verified on local disk.\n");

  // ---------------------------------------------------------------------------
  // TEST 3: System Status & Capability Separation
  // Status must clearly return 'LOCAL AI: READY' and separate local AI from internet-dependent services
  // ---------------------------------------------------------------------------
  console.log("3. Verifying System Status & Service Separation...");
  loadModel(); // Ensure model is loaded
  const status = getModelStatus();

  console.log(`   System Status: ${status.system_status}`);
  console.log(`   Status Label: ${status.status_label}`);
  console.log(`   Is Ready: ${status.isReady}`);
  console.log(`   Cloud AI Dependency: ${status.cloud_ai_dependency}`);

  assert.strictEqual(status.system_status, "LOCAL AI: READY", "Status must be 'LOCAL AI: READY'");
  assert.strictEqual(status.status_label, "READY");
  assert.strictEqual(status.isReady, true);
  assert.strictEqual(status.cloud_ai_dependency, false);

  // Validate capability separation
  assert.ok(status.capabilities, "Capabilities breakdown must exist");
  console.log("   Capability Breakdown:");
  console.log(`     - Local AI: ${status.capabilities.local_ai.status} (Requires Internet: ${status.capabilities.local_ai.requires_internet})`);
  console.log(`     - Routing Service: ${status.capabilities.routing_service.status} (Requires Internet: ${status.capabilities.routing_service.requires_internet})`);
  console.log(`     - Basemap Tiles: ${status.capabilities.basemap_tiles.status} (Requires Internet: ${status.capabilities.basemap_tiles.requires_internet})`);
  console.log(`     - Geodata Grid: ${status.capabilities.geodata_grid.status} (Requires Internet: ${status.capabilities.geodata_grid.requires_internet})`);

  assert.strictEqual(status.capabilities.local_ai.requires_internet, false, "Local AI capability must NOT require internet");
  assert.strictEqual(status.capabilities.routing_service.requires_internet, true, "Routing service dependency must be honestly declared");
  assert.strictEqual(status.capabilities.basemap_tiles.requires_internet, true, "Basemap tile service dependency must be honestly declared");
  console.log("   ✓ System status and capability separation PASSED.\n");

  // ---------------------------------------------------------------------------
  // TEST 4: Local On-Device Inference Without Cloud APIs
  // ---------------------------------------------------------------------------
  console.log("4. Executing Real Local On-Device Inference...");
  const floodVector = new Array(64).fill(0.0);
  for (let i = 0; i < 12; i++) floodVector[i] = 2.5; // Trigger flood class

  const inferStart = performance.now();
  const inferResult = classifyHazard({ features: floodVector }, { district: "Kamrup Metropolitan" });
  const inferElapsed = performance.now() - inferStart;

  console.log(`   Inference Result: ${inferResult.hazard_type} (${inferResult.predicted_class})`);
  console.log(`   Confidence: ${(inferResult.confidence * 100).toFixed(1)}% | Severity: ${inferResult.severity}`);
  console.log(`   Source: ${inferResult.source}`);
  console.log(`   Execution Latency: ${inferResult.inference_time_ms} ms (Total turn-around: ${inferElapsed.toFixed(2)} ms)`);

  assert.strictEqual(inferResult.source, "local_ai", "Source must be 'local_ai'");
  assert.strictEqual(inferResult.fallback, false, "Inference must succeed without fallback");
  assert.strictEqual(inferResult.hazard_type, "FLOOD");
  assert.ok(inferResult.confidence >= 0.70);
  assert.ok(inferResult.inference_time_ms < 10.0, "Local inference latency must be sub-10ms");
  console.log("   ✓ Local on-device inference verified without cloud API calls.\n");

  // ---------------------------------------------------------------------------
  // TEST 5: Graceful Degradation When Model is Unavailable
  // When local model is missing or uninitialized:
  // - System status becomes 'LOCAL AI: UNAVAILABLE'
  // - AI inference gracefully rejects without crashing
  // - Existing manual workflow continues functioning with 100% fidelity
  // ---------------------------------------------------------------------------
  console.log("5. Testing Graceful Degradation When Local Model is Unavailable...");
  loadModel("invalid/nonexistent_model_artifact.json"); // Force uninitialized state

  const unavailStatus = getModelStatus();
  console.log(`   Updated System Status: ${unavailStatus.system_status}`);
  console.log(`   Status Label: ${unavailStatus.status_label}`);
  console.log(`   Is Ready: ${unavailStatus.isReady}`);

  assert.strictEqual(unavailStatus.system_status, "LOCAL AI: UNAVAILABLE", "Status must be 'LOCAL AI: UNAVAILABLE'");
  assert.strictEqual(unavailStatus.isReady, false);

  // 5a. AI pipeline safely rejects automatic routing
  const failedAiResult = await processHazardPipeline({
    features: floodVector,
  });

  console.log(`   AI Execution Outcome: Success=${failedAiResult.success} | Eligible=${failedAiResult.routing_integration?.eligible_for_routing} | Status=${failedAiResult.routing_integration?.status}`);
  assert.strictEqual(failedAiResult.success, false);
  assert.strictEqual(failedAiResult.routing_integration.eligible_for_routing, false);
  assert.strictEqual(failedAiResult.routing_integration.status, "INFERENCE_FAILED");

  // 5b. Existing manual workflow remains 100% operational!
  const manualFallbackResult = await processHazardPipeline({
    manualPayload: {
      eventType: "ROAD_BLOCKAGE",
      hazardType: "DEBRIS",
      severity: 75.0,
      locationText: "Nongpoh Highway Sector",
      district: "Ri-Bhoi",
      state: "Meghalaya",
      roadBlocked: true,
    },
    sourceAttribution: "manual",
  });

  console.log(`   Manual Fallback Outcome: Source=${manualFallbackResult.source} | Eligible=${manualFallbackResult.routing_integration?.eligible_for_routing} | Status=${manualFallbackResult.routing_integration?.status}`);
  assert.strictEqual(manualFallbackResult.source_attribution, "manual");
  assert.strictEqual(manualFallbackResult.routing_integration.eligible_for_routing, true);
  assert.strictEqual(manualFallbackResult.routing_integration.status, "MANUAL_OPERATOR_VERIFIED");
  console.log("   ✓ Graceful fallback to manual reporting verified when local model is unavailable.\n");

  // Restore model
  loadModel();
  const restoredStatus = getModelStatus();
  assert.strictEqual(restoredStatus.system_status, "LOCAL AI: READY");
  console.log(`   Model Restored: Status is now '${restoredStatus.system_status}'.\n`);

  console.log("================================================================================");
  console.log("         ALL STEP 6 LOCAL/OFFLINE AI MODE REQUIREMENTS PASSED (100% OK)         ");
  console.log("================================================================================");
}

runOfflineAiTests().catch((err) => {
  console.error("❌ Offline AI Mode Test Failed:", err);
  process.exit(1);
});
