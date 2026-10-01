// Configuration for Qualcomm Snapdragon Local AI Inference Module
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SNAPDRAGON_CONFIG = Object.freeze({
  // AI Execution Mode: 'local' (Runs strictly on-device without cloud AI APIs)
  AI_MODE: (process.env.AI_MODE || "local").toLowerCase(),

  // Global enable/disable flag
  ENABLED: process.env.SNAPDRAGON_AI_ENABLED !== "false",

  // Model file artifact paths (configurable via environment, stored locally)
  MODEL_PATH:
    process.env.SNAPDRAGON_MODEL_PATH ||
    path.resolve(__dirname, "./models/mobilenet_v3_hazard_v1.json"),

  CLASSES_PATH:
    process.env.SNAPDRAGON_CLASSES_PATH ||
    path.resolve(__dirname, "./models/hazard_classes.json"),

  // Target Hardware & Runtime configuration
  TARGET_HARDWARE: process.env.SNAPDRAGON_TARGET_HARDWARE || "Qualcomm Snapdragon X Elite / Hexagon NPU",
  EXECUTION_PROVIDER: process.env.SNAPDRAGON_EXECUTION_PROVIDER || "auto", // 'qnn' | 'cpu' | 'auto'

  // Model Metadata
  MODEL_NAME: "MobileNetV3-Large-Disaster-Hazard",
  MODEL_VERSION: "v1.0-snapdragon",
  QUALCOMM_AI_HUB_ID: "qai_hub_models.models.mobilenet_v3_large",

  // Inference thresholds & safety parameters
  CONFIDENCE_THRESHOLD: parseFloat(process.env.SNAPDRAGON_CONFIDENCE_THRESHOLD || "0.70"),
  LOG_LATENCY: process.env.SNAPDRAGON_LOG_LATENCY !== "false",

  // Local / Offline AI Mode Guarantees
  ALLOW_CLOUD_AI_FALLBACK: false, // Strictly false: never send image data to external cloud AI APIs
  FALLBACK_TO_MANUAL: process.env.AI_FALLBACK_TO_MANUAL !== "false", // Graceful fallback to existing manual workflow if model is unavailable
  OFFLINE_CAPABLE: true, // Local inference requires zero internet connectivity

  // Default regional affected corridor radius in meters when location text is ambiguous
  DEFAULT_AFFECTED_RADIUS_METERS: {
    FLOOD: 12000,
    STRUCTURAL: 6000,
    LANDSLIDE: 5000,
    INFRASTRUCTURE: 6000,
    NONE: 0,
  },
});

export default SNAPDRAGON_CONFIG;
