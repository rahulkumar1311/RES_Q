import fs from "fs";
import { performance } from "perf_hooks";
import SNAPDRAGON_CONFIG from "./snapdragonConfig.js";
import { decodeImageInput, extractImageFeatures } from "./imagePreprocessor.js";
import {
  detectHardware,
  resolveExecutionBackend,
  quantizeWeightsToInt8,
  runQuantizedInference,
} from "./snapdragonOptimizer.js";

// Internal Model State
let modelState = {
  isReady: false,
  modelName: SNAPDRAGON_CONFIG.MODEL_NAME,
  version: SNAPDRAGON_CONFIG.MODEL_VERSION,
  targetHardware: SNAPDRAGON_CONFIG.TARGET_HARDWARE,
  executionProvider: "cpu-fallback",
  hardwareInfo: detectHardware(),
  backendInfo: resolveExecutionBackend(),
  classes: [],
  classMetadata: new Map(),
  weights: [],
  bias: [],
  quantizedWeights: null,
  scales: null,
  featureDimension: 64,
  loadError: null,
  modelPath: SNAPDRAGON_CONFIG.MODEL_PATH,
  lastInferenceTime: 0.0,
};

/**
 * Loads model parameters and hazard metadata into memory
 * @param {string|null} customModelPath - Optional custom path for test suites
 * @returns {boolean} Success status
 */
export function loadModel(customModelPath = null) {
  const modelPath = customModelPath || SNAPDRAGON_CONFIG.MODEL_PATH;

  try {
    if (!fs.existsSync(modelPath)) {
      console.warn(`[SNAPDRAGON-AI] Model artifact not found at: ${modelPath}. Local fallback active.`);
      modelState.isReady = false;
      modelState.loadError = `Model file missing at ${modelPath}`;
      return false;
    }

    const rawData = fs.readFileSync(modelPath, "utf8");
    const jsonModel = JSON.parse(rawData);

    // Load hazard classes dictionary
    let classMetadata = new Map();
    if (fs.existsSync(SNAPDRAGON_CONFIG.CLASSES_PATH)) {
      try {
        const rawClasses = fs.readFileSync(SNAPDRAGON_CONFIG.CLASSES_PATH, "utf8");
        const classesJson = JSON.parse(rawClasses);
        if (Array.isArray(classesJson.classes)) {
          for (const item of classesJson.classes) {
            classMetadata.set(item.id, item);
          }
        }
      } catch (classErr) {
        console.warn("[SNAPDRAGON-AI] Warning loading class metadata:", classErr.message);
      }
    }

    // Dynamic Hardware Detection & Backend Resolution
    // Detected hardware/backend -> Supported execution backend -> AI inference
    const hw = detectHardware();
    const backendResolution = resolveExecutionBackend(SNAPDRAGON_CONFIG.EXECUTION_PROVIDER);

    // Prepare INT8 Quantized weights for Snapdragon NPU acceleration
    let quantizedWeights = null;
    let scales = null;
    if (jsonModel.quantized_weights && jsonModel.quantization?.scales) {
      quantizedWeights = jsonModel.quantized_weights;
      scales = jsonModel.quantization.scales;
    } else if (Array.isArray(jsonModel.weights) && jsonModel.weights.length > 0) {
      try {
        const qRes = quantizeWeightsToInt8(jsonModel.weights, jsonModel.bias);
        quantizedWeights = qRes.quantizedWeights;
        scales = qRes.scales;
      } catch (_) {}
    }

    modelState = {
      isReady: true,
      modelName: jsonModel.model_name || SNAPDRAGON_CONFIG.MODEL_NAME,
      version: jsonModel.model_version || SNAPDRAGON_CONFIG.MODEL_VERSION,
      targetHardware: backendResolution.targetHardware,
      executionProvider: backendResolution.backend,
      hardwareInfo: hw,
      backendInfo: backendResolution,
      classes: jsonModel.classes || [],
      classMetadata,
      weights: jsonModel.weights || [],
      bias: jsonModel.bias || [],
      quantizedWeights,
      scales,
      featureDimension: jsonModel.feature_dimension || 64,
      loadError: null,
      modelPath,
      lastInferenceTime: 0.0,
    };

    console.log(
      `[SNAPDRAGON-AI] Loaded ${modelState.modelName} (${modelState.version}) on ${modelState.executionProvider}. (${modelState.classes.length} classes | Hardware: ${hw.processor} [${backendResolution.precision}])`
    );
    return true;
  } catch (err) {
    console.error("[SNAPDRAGON-AI] Failed to load model artifact:", err.message);
    modelState.isReady = false;
    modelState.loadError = err.message;
    return false;
  }
}

/**
 * Returns current health, initialization status, and hardware/runtime detection of the AI engine
 */
export function getModelStatus() {
  const isReady = Boolean(modelState.isReady && SNAPDRAGON_CONFIG.ENABLED);
  const statusString = isReady ? "LOCAL AI: READY" : "LOCAL AI: UNAVAILABLE";
  const hw = modelState.hardwareInfo || detectHardware();
  const backend = modelState.backendInfo || resolveExecutionBackend();

  return {
    system_status: statusString,
    status_label: isReady ? "READY" : "UNAVAILABLE",
    ai_mode: SNAPDRAGON_CONFIG.AI_MODE,
    isReady,
    is_offline_capable: true,
    cloud_ai_dependency: false,

    // The 6 explicitly required runtime exposure fields:
    device: hw.device,
    processor: hw.processor,
    ai_backend: backend.backend,
    model: modelState.modelName,
    precision: backend.precision,
    inference_time: modelState.lastInferenceTime || 0.0,

    modelName: modelState.modelName,
    version: modelState.version,
    targetHardware: backend.targetHardware,
    executionProvider: backend.backend,
    classesCount: modelState.classes.length,
    classes: modelState.classes,
    modelPath: modelState.modelPath,
    loadError: modelState.loadError,

    // Explicit separation of local AI capabilities from internet-dependent services
    capabilities: {
      local_ai: {
        status: isReady ? "READY" : "UNAVAILABLE",
        mode: "ON_DEVICE",
        runtime: backend.backend,
        hardware: backend.targetHardware,
        precision: backend.precision,
        requires_internet: false,
        acceleration_active: backend.accelerationActive,
        description: "Runs visual disaster hazard classification locally on Snapdragon NPU / CPU without cloud AI APIs.",
      },
      routing_service: {
        status: "OPERATIONAL",
        engine: "Valhalla (Primary) / OpenStreetMap (Fallback)",
        requires_internet: true,
        description: "Dynamic route calculation and physical detour planning.",
      },
      geodata_grid: {
        status: "OPERATIONAL",
        grid_architecture: "PostGIS 500m Grid (408,986 cells)",
        requires_internet: false,
        description: "Assam & Meghalaya risk grid cells and corridor spatial intersections.",
      },
      basemap_tiles: {
        status: "OPERATIONAL",
        provider: "Vector/Raster Tile Server",
        requires_internet: true,
        description: "MapLibre basemap tiles rendered on client display.",
      },
    },
  };
}

/**
 * Softmax probability distribution computation
 * @param {number[]} logits 
 * @returns {number[]} probabilities
 */
function softmax(logits) {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - maxLogit));
  const sumExps = exps.reduce((acc, val) => acc + val, 0);
  return exps.map((val) => (sumExps > 0 ? val / sumExps : 1.0 / logits.length));
}

/**
 * Executes local on-device hazard classification on input image or visual feature representation
 * Returns structured hazard assessment conforming to RESQ specifications
 * 
 * @param {string|Buffer|object} imageInput - Base64 image string, binary Buffer, or feature object
 * @param {object} options - Location and convoy options
 * @returns {object} Structured JSON result
 */
export function classifyHazard(imageInput, options = {}) {
  const startTime = performance.now();

  // 1. Fail-Safe fallback check if model is uninitialized
  if (!modelState.isReady) {
    const elapsed = Math.round((performance.now() - startTime) * 100) / 100;
    return {
      hazard_type: "UNKNOWN",
      confidence: 0.0,
      severity: "UNKNOWN",
      affected_area: "0m",
      source: "local_ai",
      inference_time_ms: elapsed,
      event_type: "HAZARD_UNKNOWN",
      model_version: modelState.version,
      execution_provider: modelState.executionProvider,
      fallback: true,
      error: modelState.loadError || "Model not initialized",
      passability: {
        status: "CAUTION",
        road_blocked: false,
        bridge_closed: false,
        bridge_damaged: false,
      },
    };
  }

  try {
    let features;

    // Check if caller directly provided simulated/precomputed features
    if (
      imageInput &&
      typeof imageInput === "object" &&
      !Buffer.isBuffer(imageInput) &&
      Array.isArray(imageInput.features)
    ) {
      features = new Float32Array(imageInput.features);
    } else {
      // Decode image buffer from base64, buffer, or string
      const { buffer } = decodeImageInput(imageInput);
      features = extractImageFeatures(buffer);
    }

    // 2. Perform Linear Projection Layer (NPU INT8 Quantized vs CPU FP32)
    let logits;
    if (modelState.backendInfo?.backend === "qnn-npu" && modelState.quantizedWeights) {
      logits = runQuantizedInference(features, modelState.quantizedWeights, modelState.scales, modelState.bias);
    } else {
      const numClasses = modelState.classes.length;
      logits = new Array(numClasses).fill(0);
      for (let c = 0; c < numClasses; c++) {
        let dotProduct = modelState.bias[c] || 0.0;
        const classWeights = modelState.weights[c] || [];
        const featLen = Math.min(features.length, classWeights.length);
        for (let i = 0; i < featLen; i++) {
          dotProduct += classWeights[i] * features[i];
        }
        logits[c] = dotProduct;
      }
    }

    // 3. Compute Softmax Probabilities
    const probs = softmax(logits);

    // 4. Find Top Class
    const numClasses = modelState.classes.length;
    let maxIdx = 0;
    let maxProb = probs[0];
    const classProbabilities = {};

    for (let i = 0; i < numClasses; i++) {
      const clsName = modelState.classes[i];
      const p = Math.round(probs[i] * 1000) / 1000;
      classProbabilities[clsName] = p;
      if (probs[i] > maxProb) {
        maxProb = probs[i];
        maxIdx = i;
      }
    }

    const predictedClassId = modelState.classes[maxIdx];
    const meta = modelState.classMetadata.get(predictedClassId) || {
      displayName: predictedClassId.replace(/_/g, " "),
      hazardType: predictedClassId.includes("FLOOD") ? "FLOOD" : predictedClassId.includes("LANDSLIDE") ? "LANDSLIDE" : "GENERAL",
      eventType: "ROAD_BLOCKAGE",
      defaultSeverity: 75.0,
      roadBlocked: predictedClassId !== "CLEAR_NORMAL_ROAD",
      bridgeClosed: predictedClassId.includes("BRIDGE"),
      bridgeDamaged: predictedClassId.includes("BRIDGE"),
      bufferMeters: 5000,
    };

    const finalConfidence = Math.round(maxProb * 100) / 100;
    const calculatedSeverity = Math.round(meta.defaultSeverity * finalConfidence * 10) / 10;
    const severityLabel = calculatedSeverity >= 70 ? "CRITICAL" : calculatedSeverity >= 45 ? "HIGH" : calculatedSeverity >= 25 ? "MODERATE" : "LOW";

    const elapsed = Math.round((performance.now() - startTime) * 100) / 100;
    modelState.lastInferenceTime = elapsed;

    const hw = modelState.hardwareInfo || detectHardware();
    const backend = modelState.backendInfo || resolveExecutionBackend();

    // Build the structured contract specified by RESQ exposing the 6 required runtime fields
    const result = {
      // Required Runtime Exposure Fields:
      device: hw.device,
      processor: hw.processor,
      ai_backend: backend.backend,
      model: modelState.modelName,
      precision: backend.precision,
      inference_time: elapsed,

      hazard_type: meta.hazardType,
      confidence: finalConfidence,
      severity: severityLabel,
      severity_score: calculatedSeverity,
      affected_area: `${meta.bufferMeters}m corridor buffer`,
      source: "local_ai",
      inference_time_ms: elapsed,

      // Rich RESQ Operational Details
      event_type: meta.eventType,
      predicted_class: predictedClassId,
      display_name: meta.displayName,
      model_version: modelState.version,
      model_name: modelState.modelName,
      target_hardware: backend.targetHardware,
      execution_provider: backend.backend,
      fallback: false,
      passability: {
        status: meta.roadBlocked || meta.bridgeClosed ? "IMPASSABLE" : calculatedSeverity >= 25 ? "PASSABLE_WITH_CAUTION" : "CLEAR",
        road_blocked: meta.roadBlocked,
        bridge_closed: meta.bridgeClosed,
        bridge_damaged: meta.bridgeDamaged,
      },
      class_probabilities: classProbabilities,
    };

    if (SNAPDRAGON_CONFIG.LOG_LATENCY) {
      console.log(
        `[SNAPDRAGON-AI] Inferred ${predictedClassId} (Conf: ${finalConfidence}, Sev: ${severityLabel}) in ${elapsed} ms [${backend.backend} | ${backend.precision}]`
      );
    }

    return result;
  } catch (err) {
    const elapsed = Math.round((performance.now() - startTime) * 100) / 100;
    console.error("[SNAPDRAGON-AI] Classification error:", err.message);

    const hw = modelState.hardwareInfo || detectHardware();
    const backend = modelState.backendInfo || resolveExecutionBackend();

    return {
      device: hw.device,
      processor: hw.processor,
      ai_backend: backend.backend,
      model: modelState.modelName,
      precision: backend.precision,
      inference_time: elapsed,

      hazard_type: "UNKNOWN",
      confidence: 0.0,
      severity: "LOW",
      affected_area: "0m",
      source: "local_ai",
      inference_time_ms: elapsed,
      event_type: "CLASSIFICATION_ERROR",
      model_version: modelState.version,
      execution_provider: backend.backend,
      fallback: true,
      error: err.message,
      passability: {
        status: "CAUTION",
        road_blocked: false,
        bridge_closed: false,
        bridge_damaged: false,
      },
    };
  }
}

// Auto-load model on module import
loadModel();

export default {
  loadModel,
  getModelStatus,
  classifyHazard,
};
