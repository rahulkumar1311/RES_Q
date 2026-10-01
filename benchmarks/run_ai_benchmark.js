#!/usr/bin/env node
// RESQ AI Inference Benchmarking Utility
// Measures actual model loading, cold start, warm-up, steady-state latency,
// model footprint, memory utilization, and real hardware telemetry.
//
// Strict Invariant: Does not insert fake benchmark values or fabricate Snapdragon hardware.

import fs from "fs";
import path from "path";
import os from "os";
import { performance } from "perf_hooks";
import { fileURLToPath } from "url";

// Load services from server module
import {
  loadModel,
  getModelStatus,
  classifyHazard,
} from "../server/services/snapdragon/snapdragonVisionService.js";
import {
  detectHardware,
  resolveExecutionBackend,
} from "../server/services/snapdragon/snapdragonOptimizer.js";
import SNAPDRAGON_CONFIG from "../server/services/snapdragon/snapdragonConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Command Line Argument Parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    samples: 50,
    warmup: 5,
    output: null,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--samples" && args[i + 1]) {
      options.samples = Math.max(1, parseInt(args[++i], 10) || 50);
    } else if (args[i] === "--warmup" && args[i + 1]) {
      options.warmup = Math.max(0, parseInt(args[++i], 10) || 5);
    } else if (args[i] === "--output" && args[i + 1]) {
      options.output = args[++i];
    } else if (args[i] === "--verbose" || args[i] === "-v") {
      options.verbose = true;
    }
  }

  return options;
}

// Percentile Calculation
function calculatePercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (lower === upper) return sortedArray[lower];
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

// Standard Deviation Calculation
function calculateStdDev(array, mean) {
  if (array.length <= 1) return 0;
  const variance = array.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (array.length - 1);
  return Math.sqrt(variance);
}

// Sample Generator for Varied Disaster Scenarios
function createBenchmarkWorkload() {
  const samples = [];

  // Scenario 1: Flood Water Submergence
  const floodVector = new Array(64).fill(0.0);
  for (let i = 0; i < 12; i++) floodVector[i] = 2.0;
  samples.push({ name: "Flood Water Submergence", input: { features: floodVector } });

  // Scenario 2: Structural Bridge Collapse
  const bridgeVector = new Array(64).fill(0.0);
  for (let i = 12; i < 24; i++) bridgeVector[i] = 2.2;
  samples.push({ name: "Structural Bridge Collapse", input: { features: bridgeVector } });

  // Scenario 3: Landslide Debris Obstruction
  const landslideVector = new Array(64).fill(0.0);
  for (let i = 24; i < 36; i++) landslideVector[i] = 1.9;
  samples.push({ name: "Landslide Debris Obstruction", input: { features: landslideVector } });

  // Scenario 4: Road Surface Washout
  const washoutVector = new Array(64).fill(0.0);
  for (let i = 36; i < 48; i++) washoutVector[i] = 1.8;
  samples.push({ name: "Road Surface Washout", input: { features: washoutVector } });

  // Scenario 5: Clear Passable Road
  const clearVector = new Array(64).fill(0.0);
  for (let i = 48; i < 64; i++) clearVector[i] = 2.5;
  samples.push({ name: "Clear Passable Road", input: { features: clearVector } });

  // Scenario 6: Simulated Drone Aerial Frame (Binary Buffer with JPEG Signature)
  const droneBuffer = Buffer.alloc(2048, 0x80);
  droneBuffer[0] = 0xff;
  droneBuffer[1] = 0xd8; // JPEG SOI marker
  samples.push({ name: "Drone Aerial Imagery Frame", input: droneBuffer });

  // Scenario 7: Ground Camera Field Photo (Base64 JPEG Simulation)
  const cameraBuffer = Buffer.alloc(1024, 0x5a);
  cameraBuffer[0] = 0xff;
  cameraBuffer[1] = 0xd8;
  samples.push({
    name: "Ground Field Photo (Data URI)",
    input: `data:image/jpeg;base64,${cameraBuffer.toString("base64")}`,
  });

  return samples;
}

export async function runBenchmark(opts = {}) {
  const options = { ...parseArgs(), ...opts };

  console.log("================================================================================");
  console.log("                   RESQ AI INFERENCE BENCHMARK SYSTEM                           ");
  console.log("================================================================================\n");

  // Step 1: Detect Real Hardware (Strict Anti-Fabrication)
  console.log("1. Inspecting Host Hardware & Acceleration Topology...");
  const memInitial = process.memoryUsage();
  const hw = detectHardware();
  const backend = resolveExecutionBackend();

  const isSnapdragon = Boolean(hw.isSnapdragon);
  const machineType = isSnapdragon ? "snapdragon_machine" : "development_machine";
  const isNpuAccelerated = Boolean(hw.hasNpuHardware && backend.backend === "qnn-npu");

  console.log(`   Machine Classification: ${machineType.toUpperCase()}`);
  console.log(`   Hardware Device:        ${hw.device}`);
  console.log(`   Processor:              ${hw.processor}`);
  console.log(`   Architecture:           ${hw.architecture} (${hw.cores} cores)`);
  console.log(`   System RAM:             ${hw.totalMemoryGB} GB`);
  console.log(`   Execution Backend:      ${backend.backend}`);
  console.log(`   Computation Precision:  ${backend.precision}`);
  console.log(`   Snapdragon Detected:    ${isSnapdragon ? "YES (Qualcomm ARM64)" : "NO (Non-Snapdragon Host)"}`);
  console.log(`   NPU Acceleration:       ${isNpuAccelerated ? "ACTIVE (Hexagon HTP)" : "INACTIVE / NOT PRESENT"}\n`);

  // Step 2: Measure Model Loading Time & Footprint
  console.log("2. Measuring Model Artifact Loading Time & Footprint...");
  const modelPath = SNAPDRAGON_CONFIG.MODEL_PATH;
  let modelSizeBytes = 0;
  if (fs.existsSync(modelPath)) {
    modelSizeBytes = fs.statSync(modelPath).size;
  }
  const modelSizeMb = Math.round((modelSizeBytes / (1024 * 1024)) * 10000) / 10000;

  // Measure cold model load
  const loadStart = performance.now();
  const loadSuccess = loadModel(modelPath);
  const modelLoadingMs = Math.round((performance.now() - loadStart) * 100) / 100;

  if (!loadSuccess) {
    throw new Error(`Failed to load model artifact from ${modelPath}`);
  }

  const modelStatus = getModelStatus();
  console.log(`   Model Name:             ${modelStatus.modelName} (v${modelStatus.version})`);
  console.log(`   Artifact Size:          ${modelSizeMb} MB (${Math.round(modelSizeBytes / 1024)} KB)`);
  console.log(`   Load Duration:          ${modelLoadingMs} ms`);
  console.log(`   Model Status:           ${modelStatus.system_status}\n`);

  // Step 3: Measure Cold Start Inference
  console.log("3. Measuring Cold-Start Inference Latency...");
  const workload = createBenchmarkWorkload();
  const coldWorkload = workload[0];

  const coldStart = performance.now();
  const coldResult = classifyHazard(coldWorkload.input);
  const coldInferenceMs = Math.round((performance.now() - coldStart) * 100) / 100;

  console.log(`   Scenario:               ${coldWorkload.name}`);
  console.log(`   Predicted Hazard:       ${coldResult.hazard_type} (Conf: ${(coldResult.confidence * 100).toFixed(1)}%)`);
  console.log(`   Cold Inference Latency: ${coldInferenceMs} ms\n`);

  // Step 4: Warm-up Passes
  const warmupPasses = options.warmup;
  let warmupMs = 0;
  if (warmupPasses > 0) {
    console.log(`4. Executing ${warmupPasses} Warm-Up Iterations...`);
    const warmupStart = performance.now();
    for (let i = 0; i < warmupPasses; i++) {
      const item = workload[i % workload.length];
      classifyHazard(item.input);
    }
    warmupMs = Math.round((performance.now() - warmupStart) * 100) / 100;
    console.log(`   Warm-Up Completed in:   ${warmupMs} ms (Avg: ${(warmupMs / warmupPasses).toFixed(2)} ms/iter)\n`);
  }

  // Step 5: Steady-State Inference Benchmark Loop
  const sampleCount = options.samples;
  console.log(`5. Running Steady-State Benchmark (${sampleCount} inference samples)...`);
  const latencies = [];

  for (let i = 0; i < sampleCount; i++) {
    const item = workload[i % workload.length];
    const t0 = performance.now();
    classifyHazard(item.input);
    const t1 = performance.now();
    const duration = t1 - t0;
    latencies.push(duration);

    if (options.verbose && (i + 1) % 10 === 0) {
      process.stdout.write(`   [Sample ${i + 1}/${sampleCount}] Latency: ${duration.toFixed(3)} ms\n`);
    }
  }

  // Step 6: Compute Statistical Metrics
  latencies.sort((a, b) => a - b);
  const sumMs = latencies.reduce((acc, val) => acc + val, 0);
  const avgInferenceMs = Math.round((sumMs / sampleCount) * 1000) / 1000;
  const minInferenceMs = Math.round(latencies[0] * 1000) / 1000;
  const maxInferenceMs = Math.round(latencies[latencies.length - 1] * 1000) / 1000;
  const p50Ms = Math.round(calculatePercentile(latencies, 50) * 1000) / 1000;
  const p95Ms = Math.round(calculatePercentile(latencies, 95) * 1000) / 1000;
  const p99Ms = Math.round(calculatePercentile(latencies, 99) * 1000) / 1000;
  const stdDevMs = Math.round(calculateStdDev(latencies, avgInferenceMs) * 1000) / 1000;

  // Step 7: Measure Memory Utilization
  const memFinal = process.memoryUsage();
  const memUsage = {
    rss_mb: Math.round((memFinal.rss / (1024 * 1024)) * 100) / 100,
    heap_used_mb: Math.round((memFinal.heapUsed / (1024 * 1024)) * 100) / 100,
    heap_total_mb: Math.round((memFinal.heapTotal / (1024 * 1024)) * 100) / 100,
    heap_delta_mb: Math.round(((memFinal.heapUsed - memInitial.heapUsed) / (1024 * 1024)) * 100) / 100,
  };

  // Compile Final Standard Benchmark JSON
  // Matches exact user requirements:
  // { model, runtime, backend, device, samples, avg_inference_ms, min_inference_ms, max_inference_ms, model_size_mb }
  const benchmarkResult = {
    model: modelStatus.modelName,
    runtime: `Node.js ${process.version} (Local On-Device Engine)`,
    backend: backend.backend,
    device: hw.device,
    samples: sampleCount,
    avg_inference_ms: avgInferenceMs,
    min_inference_ms: minInferenceMs,
    max_inference_ms: maxInferenceMs,
    model_size_mb: modelSizeMb,

    // Extended actual measured metrics
    model_loading_ms: modelLoadingMs,
    cold_inference_ms: coldInferenceMs,
    warmup_inference_ms: warmupMs,
    warmup_samples: warmupPasses,
    p50_inference_ms: p50Ms,
    p95_inference_ms: p95Ms,
    p99_inference_ms: p99Ms,
    std_dev_ms: stdDevMs,
    precision: backend.precision,
    memory_usage_mb: memUsage,

    // Hardware & Platform Truth Verification
    hardware: {
      processor: hw.processor,
      architecture: hw.architecture,
      cores: hw.cores,
      total_memory_gb: hw.totalMemoryGB,
      has_npu_hardware: hw.hasNpuHardware,
      qnn_sdk_present: hw.qnnSdkPresent,
      platform: process.platform,
      os_type: os.type(),
      os_release: os.release(),
    },
    machine_type: machineType,
    is_snapdragon: isSnapdragon,
    is_npu_accelerated: isNpuAccelerated,
    timestamp: new Date().toISOString(),
  };

  // Print Formatted Summary
  console.log("--------------------------------------------------------------------------------");
  console.log("                         BENCHMARK RESULTS SUMMARY                              ");
  console.log("--------------------------------------------------------------------------------");
  console.log(`   Model:                  ${benchmarkResult.model}`);
  console.log(`   Runtime:                ${benchmarkResult.runtime}`);
  console.log(`   Execution Backend:      ${benchmarkResult.backend} (${benchmarkResult.precision})`);
  console.log(`   Device / Host:          ${benchmarkResult.device}`);
  console.log(`   Processor:              ${benchmarkResult.hardware.processor}`);
  console.log(`   Machine Category:       ${benchmarkResult.machine_type.toUpperCase()}`);
  console.log(`   Model Size:             ${benchmarkResult.model_size_mb} MB`);
  console.log(`   Model Loading Time:     ${benchmarkResult.model_loading_ms} ms`);
  console.log(`   Cold-Start Latency:     ${benchmarkResult.cold_inference_ms} ms`);
  console.log(`   Inference Samples:      ${benchmarkResult.samples}`);
  console.log(`   Average Latency:        ${benchmarkResult.avg_inference_ms} ms`);
  console.log(`   Min Latency:            ${benchmarkResult.min_inference_ms} ms`);
  console.log(`   Max Latency:            ${benchmarkResult.max_inference_ms} ms`);
  console.log(`   p50 (Median) Latency:   ${benchmarkResult.p50_inference_ms} ms`);
  console.log(`   p95 Latency:            ${benchmarkResult.p95_inference_ms} ms`);
  console.log(`   p99 Latency:            ${benchmarkResult.p99_inference_ms} ms`);
  console.log(`   Memory RSS:             ${benchmarkResult.memory_usage_mb.rss_mb} MB`);
  console.log(`   Memory Heap:            ${benchmarkResult.memory_usage_mb.heap_used_mb} MB`);
  console.log("--------------------------------------------------------------------------------\n");

  // Save Results to Disk
  const benchmarksDir = path.resolve(__dirname);
  const outputPath = options.output
    ? path.resolve(process.cwd(), options.output)
    : path.resolve(benchmarksDir, "benchmark_results.json");

  fs.writeFileSync(outputPath, JSON.stringify(benchmarkResult, null, 2), "utf8");
  console.log(`✓ Benchmark results saved to: ${outputPath}`);

  // Also save to machine-specific artifact file
  const machineSpecificFile = path.resolve(
    benchmarksDir,
    `${machineType}_results.json`
  );
  fs.writeFileSync(machineSpecificFile, JSON.stringify(benchmarkResult, null, 2), "utf8");
  console.log(`✓ Machine-specific artifact saved to: ${machineSpecificFile}\n`);

  return benchmarkResult;
}

// Self-executing CLI runner
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runBenchmark().catch((err) => {
    console.error("\n[BENCHMARK-ERROR] Benchmark run failed:", err);
    process.exit(1);
  });
}
