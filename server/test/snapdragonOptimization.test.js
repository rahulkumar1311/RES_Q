// Test Suite for STEP 7: Snapdragon Optimization Layer
// Verifies:
// 1. Real dynamic hardware detection without fabrication
// 2. Execution backend resolution chain (Detected HW -> Supported backend -> AI inference)
// 3. INT8 quantization precision & numerical stability
// 4. Presence of INT8 quantized model artifact
// 5. Exposure of the 6 required runtime fields:
//    - device
//    - processor
//    - AI backend
//    - model
//    - precision
//    - inference time
// 6. CPU fallback execution

import assert from "assert";
import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  detectHardware,
  resolveExecutionBackend,
  quantizeWeightsToInt8,
  runQuantizedInference,
} from "../services/snapdragon/snapdragonOptimizer.js";
import {
  loadModel,
  getModelStatus,
  classifyHazard,
} from "../services/snapdragon/snapdragonVisionService.js";
import { processHazardPipeline } from "../services/snapdragon/aiHazardPipelineService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSnapdragonOptimizationTests() {
  console.log("================================================================================");
  console.log("         RESQ STEP 7: SNAPDRAGON OPTIMIZATION & RUNTIME TEST SUITE              ");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: Real Dynamic Hardware Detection (Zero Fabrication)
  // ---------------------------------------------------------------------------
  console.log("1. Testing Real Hardware Detection...");
  const hw = detectHardware();

  console.log(`   Detected Device: ${hw.device}`);
  console.log(`   Detected Processor: ${hw.processor}`);
  console.log(`   Architecture: ${hw.architecture}`);
  console.log(`   CPU Cores: ${hw.cores}`);
  console.log(`   Total RAM: ${hw.totalMemoryGB} GB`);
  console.log(`   Is Snapdragon: ${hw.isSnapdragon}`);
  console.log(`   Has NPU Hardware: ${hw.hasNpuHardware}`);

  // Assertions ensuring real detection without fabrication
  assert.strictEqual(typeof hw.device, "string");
  assert.strictEqual(hw.processor, os.cpus()[0]?.model);
  assert.strictEqual(hw.architecture, process.arch);
  assert.strictEqual(hw.cores, os.cpus().length);
  assert.ok(hw.totalMemoryGB > 0);

  // If running on x64 Intel/AMD, ensure it does NOT falsely claim to be Snapdragon NPU
  if (process.arch !== "arm64" && !hw.processor.toLowerCase().includes("snapdragon")) {
    assert.strictEqual(hw.isSnapdragon, false, "Must not falsely detect x64 host as Snapdragon");
  }
  console.log("   ✓ Hardware accurately detected without fabrication.\n");

  // ---------------------------------------------------------------------------
  // TEST 2: Execution Backend Resolution Chain
  // Flow: Detected hardware/backend -> Supported execution backend -> AI inference
  // ---------------------------------------------------------------------------
  console.log("2. Testing Execution Backend Resolution Chain...");

  // 2a. Auto-resolution on current host
  const autoResolution = resolveExecutionBackend("auto");
  console.log(`   [AUTO-RESOLUTION] Backend: ${autoResolution.backend} | Precision: ${autoResolution.precision} | HW: ${autoResolution.targetHardware}`);
  assert.ok(["qnn-npu", "qnn-cpu", "cpu-fallback"].includes(autoResolution.backend));
  assert.ok(typeof autoResolution.precision === "string");
  assert.ok(typeof autoResolution.reason === "string");

  // 2b. Simulated Snapdragon NPU backend resolution
  process.env.SNAPDRAGON_SIMULATE_NPU = "true";
  const npuResolution = resolveExecutionBackend("qnn-npu");
  console.log(`   [NPU-RESOLUTION] Backend: ${npuResolution.backend} | Precision: ${npuResolution.precision} | Accelerated: ${npuResolution.accelerationActive}`);
  assert.strictEqual(npuResolution.backend, "qnn-npu");
  assert.strictEqual(npuResolution.precision, "INT8 Quantized (W8A8)");
  assert.strictEqual(npuResolution.accelerationActive, true);
  delete process.env.SNAPDRAGON_SIMULATE_NPU;

  // 2c. Snapdragon CPU resolution
  const cpuSnapdragonResolution = resolveExecutionBackend("qnn-cpu");
  console.log(`   [CPU-RESOLUTION] Backend: ${cpuSnapdragonResolution.backend} | Precision: ${cpuSnapdragonResolution.precision}`);
  assert.strictEqual(cpuSnapdragonResolution.backend, "qnn-cpu");
  console.log("   ✓ Execution backend resolution chain PASSED.\n");

  // ---------------------------------------------------------------------------
  // TEST 3: INT8 Symmetric Quantization & Numerical Fidelity
  // ---------------------------------------------------------------------------
  console.log("3. Testing Model Quantization Layer (W8A8)...");
  const dummyWeights = [
    [3.2, -1.8, 0.5, 2.9, -3.1],
    [-2.5, 1.4, -0.9, -1.2, 2.8],
  ];
  const dummyBias = [0.1, -0.2];

  const qResult = quantizeWeightsToInt8(dummyWeights, dummyBias);
  console.log(`   Quantized Matrix Shape: [${qResult.quantizedWeights.length}, ${qResult.quantizedWeights[0].length}]`);
  console.log(`   Per-Channel Scales: [${qResult.scales.map((s) => s.toFixed(4)).join(", ")}]`);
  console.log(`   Compression Ratio: ${qResult.compressionRatio}`);

  // Assert INT8 values strictly bounded in [-128, 127]
  for (const row of qResult.quantizedWeights) {
    for (const val of row) {
      assert.ok(val >= -128 && val <= 127, `INT8 value ${val} out of bounds`);
      assert.strictEqual(Math.round(val), val, "Quantized weight must be an integer");
    }
  }

  // Numerical correlation test between FP32 and INT8 dequantized inference
  const testFeatures = [0.8, -0.5, 0.2, 0.9, -0.7];
  const fp32Logit0 = dummyBias[0] + dummyWeights[0].reduce((acc, w, i) => acc + w * testFeatures[i], 0);
  const int8Logits = runQuantizedInference(testFeatures, qResult.quantizedWeights, qResult.scales, qResult.bias);

  const errorPct = Math.abs((int8Logits[0] - fp32Logit0) / fp32Logit0) * 100;
  console.log(`   FP32 Logit[0]: ${fp32Logit0.toFixed(4)} | INT8 Logit[0]: ${int8Logits[0].toFixed(4)} (Discrepancy: ${errorPct.toFixed(2)}%)`);
  assert.ok(errorPct < 2.0, "INT8 quantization error must be < 2% vs FP32");
  console.log("   ✓ Quantization accuracy and numerical stability PASSED.\n");

  // ---------------------------------------------------------------------------
  // TEST 4: INT8 Model Artifact Verification on Disk
  // ---------------------------------------------------------------------------
  console.log("4. Verifying INT8 Quantized Model Artifact File...");
  const int8Path = path.resolve(__dirname, "../services/snapdragon/models/mobilenet_v3_hazard_v1_int8.json");
  assert.ok(fs.existsSync(int8Path), `INT8 model artifact must exist at ${int8Path}`);

  const int8Content = JSON.parse(fs.readFileSync(int8Path, "utf8"));
  assert.ok(int8Content.model_name.includes("INT8"));
  assert.ok(Array.isArray(int8Content.quantized_weights));
  assert.ok(Array.isArray(int8Content.quantization?.scales));
  console.log(`   Artifact Verified: ${int8Content.model_name} (${int8Content.precision})`);
  console.log("   ✓ INT8 model artifact confirmed on disk.\n");

  // ---------------------------------------------------------------------------
  // TEST 5: Runtime Exposure of All 6 Required Fields
  // System must expose:
  // - device
  // - processor
  // - AI backend
  // - model
  // - precision
  // - inference time
  // ---------------------------------------------------------------------------
  console.log("5. Verifying Required Runtime Exposure Fields...");
  loadModel(); // Load active production model

  // 5a. Verify in classifyHazard
  const classification = classifyHazard({ features: new Array(64).fill(0.2) });
  console.log("   Direct Inference Output:");
  console.log(`     - device: ${classification.device}`);
  console.log(`     - processor: ${classification.processor}`);
  console.log(`     - AI backend: ${classification.ai_backend}`);
  console.log(`     - model: ${classification.model}`);
  console.log(`     - precision: ${classification.precision}`);
  console.log(`     - inference time: ${classification.inference_time} ms`);

  assert.strictEqual(typeof classification.device, "string", "Must expose device");
  assert.strictEqual(typeof classification.processor, "string", "Must expose processor");
  assert.strictEqual(typeof classification.ai_backend, "string", "Must expose ai_backend");
  assert.strictEqual(typeof classification.model, "string", "Must expose model");
  assert.strictEqual(typeof classification.precision, "string", "Must expose precision");
  assert.strictEqual(typeof classification.inference_time, "number", "Must expose inference_time");

  // 5b. Verify in getModelStatus()
  const status = getModelStatus();
  console.log("\n   System Status Endpoint Output:");
  console.log(`     - device: ${status.device}`);
  console.log(`     - processor: ${status.processor}`);
  console.log(`     - AI backend: ${status.ai_backend}`);
  console.log(`     - model: ${status.model}`);
  console.log(`     - precision: ${status.precision}`);
  console.log(`     - inference time: ${status.inference_time} ms`);

  assert.strictEqual(status.device, classification.device);
  assert.strictEqual(status.processor, classification.processor);
  assert.strictEqual(status.ai_backend, classification.ai_backend);
  assert.strictEqual(status.model, classification.model);
  assert.strictEqual(status.precision, classification.precision);

  // 5c. Verify in processHazardPipeline()
  const pipelineRes = await processHazardPipeline({
    features: new Array(64).fill(0.2),
  });
  assert.strictEqual(typeof pipelineRes.device, "string");
  assert.strictEqual(typeof pipelineRes.processor, "string");
  assert.strictEqual(typeof pipelineRes.ai_backend, "string");
  assert.strictEqual(typeof pipelineRes.model, "string");
  assert.strictEqual(typeof pipelineRes.precision, "string");
  console.log("   ✓ All 6 mandatory runtime fields verified across services.\n");

  // ---------------------------------------------------------------------------
  // TEST 6: Real Host CPU Fallback Execution
  // ---------------------------------------------------------------------------
  console.log("6. Verifying Host CPU Fallback Latency & Integrity...");
  assert.ok(classification.inference_time >= 0, "Inference time must be non-negative");
  assert.ok(classification.inference_time < 10.0, "CPU fallback inference must be fast (< 10ms)");
  console.log(`   Inference executed on ${classification.processor} in ${classification.inference_time} ms.`);
  console.log("   ✓ CPU fallback execution verified.\n");

  console.log("================================================================================");
  console.log("       ALL STEP 7 SNAPDRAGON OPTIMIZATION REQUIREMENTS PASSED (100% OK)         ");
  console.log("================================================================================\n");
}

runSnapdragonOptimizationTests().catch((err) => {
  console.error("❌ Snapdragon Optimization Test Failed:", err);
  process.exit(1);
});
