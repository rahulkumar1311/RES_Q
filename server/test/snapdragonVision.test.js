// Comprehensive Test Suite for Snapdragon Local AI Hazard Inference Layer
import assert from "assert";
import {
  loadModel,
  getModelStatus,
  classifyHazard,
} from "../services/snapdragon/snapdragonVisionService.js";

async function runTests() {
  console.log("================================================================================");
  console.log("            RESQ SNAPDRAGON LOCAL AI INFERENCE TEST SUITE                       ");
  console.log("================================================================================\n");

  // 1. Verify Model Initialization & Hardware Metadata
  console.log("1. Checking Snapdragon Model Initialization & Metadata...");
  const status = getModelStatus();
  console.log(`   Model: ${status.modelName} (v${status.version})`);
  console.log(`   Execution Provider: ${status.executionProvider}`);
  console.log(`   Target Hardware: ${status.targetHardware}`);
  console.log(`   Classes Count: ${status.classesCount} (${status.classes.join(", ")})`);

  assert.strictEqual(status.isReady, true, "Model must be ready on initialization");
  assert.strictEqual(status.classesCount, 5, "Must have exactly 5 disaster classes");
  assert.ok(status.classes.includes("FLOOD_WATER_SUBMERGENCE"));
  assert.ok(status.classes.includes("BRIDGE_STRUCTURAL_DAMAGE"));
  assert.ok(status.classes.includes("LANDSLIDE_DEBRIS_COLLAPSE"));
  assert.ok(status.classes.includes("ROAD_SURFACE_WASHOUT"));
  assert.ok(status.classes.includes("CLEAR_NORMAL_ROAD"));
  console.log("   ✓ Status & Metadata Assertions Passed.\n");

  // 2. Classify Synthetic Disaster Signatures (Deterministic Feature Vectors)
  console.log("2. Testing Hazard Classification across Target Disaster Scenarios...");

  // Scenario A: Flood Water Submergence (High activation on water reflectance slots 0..11)
  const floodFeatures = new Array(64).fill(0.0);
  for (let i = 0; i < 12; i++) floodFeatures[i] = 2.0;

  const floodRes = classifyHazard({ features: floodFeatures });
  console.log(`   [FLOOD] Class: ${floodRes.predicted_class} | Hazard: ${floodRes.hazard_type} | Conf: ${floodRes.confidence} | Sev: ${floodRes.severity} | Latency: ${floodRes.inference_time_ms}ms`);
  assert.strictEqual(floodRes.hazard_type, "FLOOD");
  assert.strictEqual(floodRes.event_type, "ROAD_FLOODING");
  assert.strictEqual(floodRes.passability.road_blocked, true);
  assert.strictEqual(floodRes.source, "local_ai");
  assert.ok(floodRes.inference_time_ms >= 0);
  assert.ok(floodRes.affected_area.includes("12000m"));

  // Scenario B: Bridge Structural Failure / Scour (High activation on slots 12..23)
  const bridgeFeatures = new Array(64).fill(0.0);
  for (let i = 12; i < 24; i++) bridgeFeatures[i] = 2.0;

  const bridgeRes = classifyHazard({ features: bridgeFeatures });
  console.log(`   [BRIDGE] Class: ${bridgeRes.predicted_class} | Hazard: ${bridgeRes.hazard_type} | Conf: ${bridgeRes.confidence} | Sev: ${bridgeRes.severity} | Latency: ${bridgeRes.inference_time_ms}ms`);
  assert.strictEqual(bridgeRes.hazard_type, "STRUCTURAL");
  assert.strictEqual(bridgeRes.event_type, "BRIDGE_COLLAPSE");
  assert.strictEqual(bridgeRes.passability.bridge_closed, true);
  assert.strictEqual(bridgeRes.passability.bridge_damaged, true);
  assert.strictEqual(bridgeRes.passability.road_blocked, true);
  assert.strictEqual(bridgeRes.severity, "CRITICAL");

  // Scenario C: Landslide / Hillside Mud & Debris Flow (High activation on slots 24..35)
  const landslideFeatures = new Array(64).fill(0.0);
  for (let i = 24; i < 36; i++) landslideFeatures[i] = 2.0;

  const slideRes = classifyHazard({ features: landslideFeatures });
  console.log(`   [LANDSLIDE] Class: ${slideRes.predicted_class} | Hazard: ${slideRes.hazard_type} | Conf: ${slideRes.confidence} | Sev: ${slideRes.severity} | Latency: ${slideRes.inference_time_ms}ms`);
  assert.strictEqual(slideRes.hazard_type, "LANDSLIDE");
  assert.strictEqual(slideRes.event_type, "ROAD_BLOCKAGE");
  assert.strictEqual(slideRes.passability.road_blocked, true);

  // Scenario D: Road Surface Washout / Embankment Collapse (High activation on slots 36..47)
  const washoutFeatures = new Array(64).fill(0.0);
  for (let i = 36; i < 48; i++) washoutFeatures[i] = 2.0;

  const washoutRes = classifyHazard({ features: washoutFeatures });
  console.log(`   [WASHOUT] Class: ${washoutRes.predicted_class} | Hazard: ${washoutRes.hazard_type} | Conf: ${washoutRes.confidence} | Sev: ${washoutRes.severity} | Latency: ${washoutRes.inference_time_ms}ms`);
  assert.strictEqual(washoutRes.hazard_type, "INFRASTRUCTURE");
  assert.strictEqual(washoutRes.event_type, "ROAD_COLLAPSE");
  assert.strictEqual(washoutRes.passability.road_blocked, true);

  // Scenario E: Clear Normal Roadway (High activation on slots 48..63)
  const clearFeatures = new Array(64).fill(0.0);
  for (let i = 48; i < 64; i++) clearFeatures[i] = 2.0;

  const clearRes = classifyHazard({ features: clearFeatures });
  console.log(`   [CLEAR] Class: ${clearRes.predicted_class} | Hazard: ${clearRes.hazard_type} | Conf: ${clearRes.confidence} | Sev: ${clearRes.severity} | Latency: ${clearRes.inference_time_ms}ms`);
  assert.strictEqual(clearRes.hazard_type, "NONE");
  assert.strictEqual(clearRes.event_type, "ROAD_CLEAR");
  assert.strictEqual(clearRes.passability.road_blocked, false);
  assert.strictEqual(clearRes.passability.status, "CLEAR");
  console.log("   ✓ All 5 Target Disaster Scenarios Passed.\n");

  // 3. Test Base64 Binary Image Ingestion
  console.log("3. Testing Binary Base64 Image Ingestion...");
  const sampleImageBuffer = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) {
    sampleImageBuffer[i] = (i * 37) % 256;
  }
  const base64DataUri = `data:image/jpeg;base64,${sampleImageBuffer.toString("base64")}`;

  const imageRes = classifyHazard(base64DataUri, { district: "Kamrup Metropolitan" });
  assert.strictEqual(imageRes.source, "local_ai");
  assert.strictEqual(imageRes.fallback, false);
  assert.ok(imageRes.confidence > 0);
  assert.ok(typeof imageRes.severity === "string");
  console.log(`   ✓ Decoded & Inferred Base64 JPEG (${sampleImageBuffer.length} bytes) in ${imageRes.inference_time_ms} ms\n`);

  // 4. Test Deterministic Reproducibility
  console.log("4. Testing Deterministic Reproducibility (Exactness)...");
  const run1 = classifyHazard(base64DataUri);
  const run2 = classifyHazard(base64DataUri);
  assert.strictEqual(run1.predicted_class, run2.predicted_class, "Repeated inference must be deterministic");
  assert.strictEqual(run1.confidence, run2.confidence, "Confidence must match identically");
  assert.strictEqual(run1.hazard_type, run2.hazard_type, "Hazard type must match identically");
  console.log("   ✓ Inferences are 100% deterministic and reproducible.\n");

  // 5. Test Fail-Safe Fallback Behavior (Invalid Model Path)
  console.log("5. Testing Fail-Safe Fallback Behavior...");
  const invalidLoaded = loadModel("invalid/path/missing_mobilenet.json");
  assert.strictEqual(invalidLoaded, false, "Missing model path must return false");

  const fallbackOutput = classifyHazard(base64DataUri);
  assert.strictEqual(fallbackOutput.fallback, true, "Must flag fallback: true when model uninitialized");
  assert.strictEqual(fallbackOutput.hazard_type, "UNKNOWN");
  assert.strictEqual(fallbackOutput.confidence, 0.0);
  assert.strictEqual(fallbackOutput.source, "local_ai");
  console.log("   ✓ Graceful fallback verified without throwing unhandled exceptions.\n");

  // 6. Restore Production Model
  console.log("6. Restoring Production Model Artifact...");
  const restored = loadModel();
  assert.strictEqual(restored, true, "Model must reload successfully from default path");
  const readyAgain = getModelStatus();
  assert.strictEqual(readyAgain.isReady, true);
  console.log("   ✓ Production model restored successfully.\n");

  console.log("================================================================================");
  console.log("        ALL SNAPDRAGON LOCAL AI INFERENCE TESTS PASSED (100% OK)                ");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("❌ Test Suite Failed:", err);
  process.exit(1);
});
