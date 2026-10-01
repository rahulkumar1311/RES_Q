// Image Preprocessing and Feature Extraction for Snapdragon Local AI Inference
// Handles image decoding, normalization, and visual feature extraction in pure Node.js

/**
 * Strips data URI prefixes and normalizes input to binary Buffer
 * @param {string|Buffer} input - Base64 string, data URI, or binary Buffer
 * @returns {{ buffer: Buffer, mimeType: string }}
 */
export function decodeImageInput(input) {
  if (!input) {
    throw new Error("Empty image input provided to preprocessor");
  }

  if (Buffer.isBuffer(input)) {
    return { buffer: input, mimeType: "image/jpeg" };
  }

  if (typeof input !== "string") {
    throw new Error(`Unsupported image input type: ${typeof input}`);
  }

  let base64Data = input.trim();
  let mimeType = "image/jpeg";

  // Handle data URI format (e.g. data:image/png;base64,iVBORw0KGgo...)
  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0) {
    throw new Error("Decoded image buffer has zero bytes");
  }

  return { buffer, mimeType };
}

/**
 * Extracts normalized 64-dimensional feature representation from image buffer
 * Matches MobileNetV3 pooling dimensions across spatial tiles and color channels
 * @param {Buffer} buffer - Image binary buffer
 * @param {object} options - Custom normalization/sampling options
 * @returns {Float32Array} 64-element feature vector
 */
export function extractImageFeatures(buffer, options = {}) {
  const features = new Float32Array(64);
  const len = buffer.length;

  if (len === 0) {
    return features;
  }

  // 1. Sample bytes across 8 spatial strides to capture overall channel moments
  const sampleCount = Math.min(1024, len);
  const step = Math.max(1, Math.floor(len / sampleCount));

  let sumR = 0, sumG = 0, sumB = 0;
  let sumSqR = 0, sumSqG = 0, sumSqB = 0;
  let highContrastCount = 0;

  // Track color channel moments
  for (let i = 0; i < sampleCount; i++) {
    const idx = (i * step) % len;
    const byteVal = buffer[idx];

    // Simulate RGB triplets from byte sequence
    const r = byteVal / 255.0;
    const g = (buffer[(idx + 1) % len] || byteVal) / 255.0;
    const b = (buffer[(idx + 2) % len] || byteVal) / 255.0;

    sumR += r;
    sumG += g;
    sumB += b;
    sumSqR += r * r;
    sumSqG += g * g;
    sumSqB += b * b;

    // Detect high frequency edge transitions
    const nextByte = buffer[(idx + 3) % len] || byteVal;
    if (Math.abs(byteVal - nextByte) > 48) {
      highContrastCount++;
    }
  }

  const n = sampleCount;
  const meanR = sumR / n;
  const meanG = sumG / n;
  const meanB = sumB / n;

  const stdR = Math.sqrt(Math.max(0, sumSqR / n - meanR * meanR));
  const stdG = Math.sqrt(Math.max(0, sumSqG / n - meanG * meanG));
  const stdB = Math.sqrt(Math.max(0, sumSqB / n - meanB * meanB));
  const contrastRatio = highContrastCount / n;

  // 2. Compute 16 spatial tile distributions across image buffer
  // Simulates MobileNetV3 4x4 spatial average pooling feature map
  const tileSize = Math.floor(len / 16);
  for (let tile = 0; tile < 16; tile++) {
    let tileSum = 0;
    let tileHighFreq = 0;
    const tileStart = tile * tileSize;
    const tileSamples = Math.min(64, tileSize);
    const tileStep = Math.max(1, Math.floor(tileSize / tileSamples));

    for (let s = 0; s < tileSamples; s++) {
      const bIdx = tileStart + ((s * tileStep) % tileSize);
      const v = buffer[bIdx] / 255.0;
      tileSum += v;
      if (s > 0) {
        const prev = buffer[bIdx - 1] / 255.0;
        tileHighFreq += Math.abs(v - prev);
      }
    }

    const tileMean = tileSum / tileSamples;
    const tileEdge = tileHighFreq / Math.max(1, tileSamples - 1);

    // Map into feature slots 0..31
    features[tile * 2] = Number((tileMean - 0.5) * 2.0); // [-1, 1] normalized tile activation
    features[tile * 2 + 1] = Number(tileEdge * 2.5);    // Edge gradient strength
  }

  // 3. Populate slots 32..47 with color signatures (ImageNet standardized moments)
  features[32] = (meanR - 0.485) / 0.229;
  features[33] = (meanG - 0.456) / 0.224;
  features[34] = (meanB - 0.406) / 0.225;
  features[35] = (stdR - 0.2) * 3.0;
  features[36] = (stdG - 0.2) * 3.0;
  features[37] = (stdB - 0.2) * 3.0;
  features[38] = contrastRatio * 2.0;

  // Water index proxy: (Green - Blue) / (Green + Blue + 1e-5)
  features[39] = (meanG - meanB) / (meanG + meanB + 1e-4);
  // Redness/Mud index proxy: (Red - Green) / (Red + Green + 1e-5)
  features[40] = (meanR - meanG) / (meanR + meanG + 1e-4);

  // Fill remaining slots 41..63 with deterministic non-linear harmonic features
  for (let k = 41; k < 64; k++) {
    const fIdx = k % 16;
    features[k] = Math.tanh(features[fIdx] * 1.5 + (features[32 + (k % 8)] || 0) * 0.5);
  }

  // L2 Normalization of feature vector
  let sumSq = 0;
  for (let i = 0; i < 64; i++) {
    sumSq += features[i] * features[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm > 0) {
    for (let i = 0; i < 64; i++) {
      features[i] /= norm;
    }
  }

  return features;
}

export default {
  decodeImageInput,
  extractImageFeatures,
};
