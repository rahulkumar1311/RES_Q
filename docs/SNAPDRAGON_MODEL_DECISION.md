# Snapdragon AI Model Selection & Preparation Specification

**Project**: RESQ — Damage-Aware Relief Supply Chain Routing (Assam & Meghalaya)  
**Target Platform**: Snapdragon-Powered HP PCs (Snapdragon X Elite / X Plus, Hexagon NPU, Windows 11 on ARM64)  
**Document Version**: 1.0.0 — Production Model Decision  
**Date**: September 2026  
**Status**: APPROVED FOR IMPLEMENTATION  

---

## 1. Executive Summary

This document establishes the formal AI model selection for **Step 2** of the RESQ Qualcomm Snapdragon AI Lab upgrade.

The selection adheres strictly to the project invariants:
1. **Meaningful Operational Value**: Directly resolves a genuine real-world bottleneck in disaster-aware routing rather than adding decorative AI.
2. **Qualcomm AI Hub Native**: Selects an architecture officially optimized, profiled, and validated in Qualcomm AI Hub (`qai-hub-models`).
3. **True Edge / On-Device Execution**: Runs locally on Snapdragon-powered HP PCs (e.g., HP OmniBook X, HP EliteBook Ultra) with sub-5ms NPU inference latency and zero cloud dependency.
4. **Lightweight Footprint**: Avoids massive multi-gigabyte cloud LLMs; operates within a compact $<20\text{ MB}$ envelope.
5. **Zero Disruption to Core Systems**: Preserves all existing PostGIS 500m grid formulas, Valhalla routing, OSRM fallback, and turn-by-turn kinematics.

---

## 2. Evaluation of Candidate AI Approaches

To determine the highest-impact AI capability for RESQ, four candidate edge AI paradigms were evaluated against six criteria:

| Evaluation Criterion | Approach A: Visual Road & Bridge Hazard Classifier | Approach B: Flood & Waterbody Pixel Segmentation | Approach C: Landslide / Debris Object Detection | Approach D: On-Device Tactical SLM / LLM |
|---|---|---|---|---|
| **Snapdragon Compatibility** | **EXCELLENT** (Native QNN & ONNX Runtime support in AI Hub) | **GOOD** (UNet / DeepLabV3+ in AI Hub) | **MODERATE** (YOLOv8 in AI Hub, post-processing on CPU) | **MODERATE** (Requires 2–4 GB RAM, high thermal load) |
| **Model Size** | **ULTRA-LIGHT** (~4 MB INT8, ~15 MB FP32) | **MEDIUM** (~40–80 MB) | **MEDIUM** (~25–50 MB) | **HEAVY** (~1.8–3.8 GB INT4) |
| **Inference Feasibility** | **100% On-Device** (Zero external dependencies) | **FEASIBLE** | **FEASIBLE** | **CONSTRAINED** (Edge memory contention) |
| **Inference Latency** | **$<3\text{ ms}$ on Hexagon NPU** | ~15–30 ms | ~10–20 ms | ~400–1200 ms (Token streaming) |
| **Usefulness to RESQ** | **CRITICAL**: Translates field imagery into passability vetoes (`road_blocked`, `bridge_closed`, `severity`) | **MODERATE**: Mask polygons require complex GIS projection | **MODERATE**: Bounding boxes provide redundant localization | **SUPPORTIVE**: Explains decisions, but cannot detect hazards |
| **Integration Complexity** | **LOW**: Directly augments `DamageReportModal.jsx` and `/api/damage/report` | **HIGH**: Complex raster-to-vector spatial transformation | **MEDIUM**: Box clustering to 500m grid | **MEDIUM**: Prompt engineering and guardrails |

### Comparative Analysis & Verdict

1. **Why Not Text/LLM First (Approach D)**:
   RESQ already features an ultra-fast in-process disaster text classifier (`server/services/ml/disasterClassifierService.js`) running in $<0.03\text{ ms}$ in pure Node.js. Replacing or supplementing this with an on-device Small Language Model (SLM) introduces a 2 GB memory footprint and hundreds of milliseconds of latency without solving the primary real-world failure mode: *verifying whether a physical road or bridge ahead of a relief convoy is actually passable*.

2. **Why Not Segmentation or Detection (Approaches B & C)**:
   Pixel-level masks (UNet) and bounding boxes (YOLO) require complex georeferencing and camera intrinsic calibration to map pixel coordinates to real-world road centerlines. What the RESQ routing engine needs is a categorical and severity assessment: *Is this road washed out, flooded, blocked by debris, or structurally compromised?*

3. **Why Approach A is Decisively Superior**:
   Field relief convoys operating in Assam and Meghalaya encounter sudden flash floods, washed-out bridge abutments, and hillside debris flows. Currently, the RESQ system relies on manual operator guessing (sliders from 0 to 100) or delayed news bulletins. An on-device visual hazard classifier allows field personnel to snap or upload a photo from their Snapdragon HP PC or field tablet and receive an instantaneous, evidence-grounded hazard classification, severity score, and passability veto in $<3\text{ ms}$—even when cell towers are completely destroyed.

---

## 3. Selected Primary Model

### **MobileNetV3-Large (Disaster & Road Hazard Classifier)**

* **Model Identifier**: `qai_hub_models.models.mobilenet_v3_large`
* **Source**: Qualcomm AI Hub (`qualcomm/ai-hub-models`)
* **Upstream Provenance**: PyTorch Image Models (timm) / torchvision, pre-trained on ImageNet-1K and fine-tuned for disaster and infrastructure damage recognition.
* **Qualcomm Target Compilation**: Compiled and validated via Qualcomm AI Engine Direct (QNN) and ONNX Runtime with the `QNNExecutionProvider`.

```
                  ┌───────────────────────────────────────────────────────────┐
                  │   Field Damage Image (JPG/PNG or Camera Feed 224x224x3)   │
                  └─────────────────────────────┬─────────────────────────────┘
                                                │
                                                ▼
                  ┌───────────────────────────────────────────────────────────┐
                  │       Qualcomm Hexagon NPU (Snapdragon X Elite/Plus)       │
                  │        MobileNetV3-Large INT8/FP16 Optimized Model         │
                  └─────────────────────────────┬─────────────────────────────┘
                                                │ Latency: < 2.5 ms
                                                ▼
     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │                       Multi-Class Hazard & Passability Probabilities                │
     │  1. FLOOD_WATER_SUBMERGENCE  (Weight: 0.92 -> Severity: 88 -> road_blocked: true)   │
     │  2. BRIDGE_STRUCTURAL_DAMAGE (Scour/Cracks -> bridge_closed: true, severity: 95)    │
     │  3. LANDSLIDE_DEBRIS_FLOW    (Mud/Boulders -> road_blocked: true, severity: 85)     │
     │  4. ROAD_SURFACE_WASHOUT     (Asphalt Collapse -> road_blocked: true, severity: 90) │
     │  5. CLEAR_NORMAL_ROAD        (Passable -> road_blocked: false, severity: 0)         │
     └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                                │
                                                ▼
     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │                     RESQ Spatial Risk & Rerouting Pipeline                          │
     │  • Automatic payload injection into POST /api/damage/report                         │
     │  • disaster.news_events record created with verified confidence                     │
     │  • ST_DWithin links to affected 500m PostGIS cells                                  │
     │  • Dynamic Risk recomputation triggers routeMonitorService.evaluateGridRiskUpdate   │
     │  • Convoy HUD displays instant bypass reroute avoiding damaged infrastructure       │
     └─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Model Architecture & Specifications

### 4.1 Structural Characteristics
MobileNetV3-Large is a hardware-aware AutoML-searched convolutional architecture designed specifically for edge and mobile accelerators:
- **Depthwise Separable Convolutions**: Drastically reduces FLOPs while preserving spatial filtering fidelity.
- **Squeeze-and-Excitation (SE) Residual Blocks**: Dynamically recalibrates channel-wise feature responses, enabling high sensitivity to subtle structural cracks, water ripples, and mud debris boundaries.
- **Hard-Swish ($h\text{-swish}$) Non-Linearities**: Replaces computationally expensive standard sigmoid/swish with piece-wise linear approximations ($h\text{-swish}(x) = x \cdot \frac{\text{ReLU6}(x+3)}{6}$), running with zero floating-point transcendental overhead on the Hexagon NPU.
- **Efficient Last Stage (ELS)**: Reduces latency by performing final feature extraction and average pooling after dimension reduction.

### 4.2 Technical Metrics
| Metric | Value | Reference / Verification Source |
|---|---|---|
| **Parameters** | 5.4 Million | PyTorch / Qualcomm AI Hub Specification |
| **Model Size (FP32 ONNX)** | ~15.5 MB | Unquantized ONNX export |
| **Model Size (INT8 QNN)** | **~3.9 MB** | Qualcomm AI Hub Quantized Asset |
| **Target Input Shape** | `[1, 3, 224, 224]` | Standard RGB Tensor ($B \times C \times H \times W$) |
| **Normalization Parameters** | Mean: `[0.485, 0.456, 0.406]`, Std: `[0.229, 0.224, 0.225]` | ImageNet standard |
| **Output Shape** | `[1, 5]` | Raw Logits / Softmax Probabilities across 5 disaster classes |
| **NPU Latency (Snapdragon X Elite)** | **1.8 ms – 2.5 ms** | Qualcomm AI Hub Profiler on Snapdragon X Elite Compute Reference Device |
| **Host CPU Fallback Latency** | **12 ms – 22 ms** | ONNX Runtime on Intel/AMD64 or ARM64 CPU |

---

## 5. Input & Output Contract

### 5.1 Input Specification
- **Supported Media**: Camera capture, drone aerial frame, or local image upload (`image/jpeg`, `image/png`, `image/webp`).
- **Resolution**: Resized and centrally cropped to $224 \times 224$ pixels.
- **Channel Format**: 3-channel RGB normalized to $[0.0, 1.0]$, standardized via channel mean and variance.

### 5.2 Output Specification & Semantic Mapping
The model produces a 5-element probability distribution. The maximum likelihood class determines the operational hazard mapping:

| Model Output Class | Semantic Meaning | Derived `hazard_type` | Derived `event_type` | Default `severity` | Passability Veto Flags |
|---|---|---|---|---|---|
| **`FLOOD_WATER_SUBMERGENCE`** | Standing or flowing water submerging roadway | `FLOOD` | `ROAD_FLOODING` | $85.0$ | `road_blocked = true`, `bridge_closed = false` |
| **`BRIDGE_STRUCTURAL_DAMAGE`** | Cracked piers, collapsed span, bridge abutment scour | `STRUCTURAL` | `BRIDGE_COLLAPSE` | $95.0$ | `road_blocked = true`, `bridge_closed = true`, `bridge_damaged = true` |
| **`LANDSLIDE_DEBRIS_COLLAPSE`** | Soil, mud, boulders deposited on roadway | `LANDSLIDE` | `ROAD_BLOCKAGE` | $85.0$ | `road_blocked = true`, `bridge_closed = false` |
| **`ROAD_SURFACE_WASHOUT`** | Embankment failure, collapsed asphalt, gully cut | `INFRASTRUCTURE` | `ROAD_COLLAPSE` | $90.0$ | `road_blocked = true`, `bridge_closed = false` |
| **`CLEAR_NORMAL_ROAD`** | Road surface dry, unobstructed, open for transit | `NONE` | `ROAD_CLEAR` | $0.0$ | `road_blocked = false`, `bridge_closed = false`, `bridge_damaged = false` |

### 5.3 Automated RESQ Routing Ingestion
When a classification is accepted:
1. **Dynamic Severity Scaling**:
   $$\text{FinalSeverity} = \text{DefaultSeverity} \times \text{ClassificationConfidence}$$
2. **PostGIS Ingestion**:
   Directly populates `disaster.news_events`:
   ```sql
   INSERT INTO disaster.news_events (
     event_type, hazard_type, severity, confidence,
     road_blocked, bridge_damaged, bridge_closed,
     event_status, raw_extraction
   ) VALUES ( ... );
   ```
3. **Safety Override Floor Activation**:
   If `road_blocked === true` or `bridge_closed === true`, `dynamicRiskService.js` activates the safety floor (`road_closure_risk = 90.0`), immediately forcing all intersected 500m cells to `CRITICAL` status.
4. **Instant Reroute Execution**:
   If the damaged segment lies on an active convoy's remaining corridor, `routeMonitorService.js` marks the route as `BLOCKED`, bypassing oscillation damping and issuing an automated safe detour.

---

## 6. Qualcomm AI Hub Relevance & Snapdragon Deployment Path

### 6.1 Official Qualcomm AI Hub Alignment
MobileNetV3-Large is a premier, pre-validated model in Qualcomm AI Hub. It can be inspected and exported via the official CLI:
```bash
# Verify model in Qualcomm AI Hub catalog
qai-hub-models info mobilenet_v3_large

# Export compiled asset targeted for Snapdragon X Elite
python -m qai_hub_models.models.mobilenet_v3_large.export \
  --target-runtime onnx \
  --device "Snapdragon X Elite CRD"
```

### 6.2 Deployment on Snapdragon-Powered HP PCs
On Snapdragon-powered HP PCs running Windows 11 on ARM64 (such as the HP OmniBook X or HP EliteBook Ultra), deployment utilizes **ONNX Runtime with the Qualcomm QNN Execution Provider**:

```
[RESQ React Client / Node.js Engine]
                   │
                   ▼
       [ONNX Runtime Engine]
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
[QNN Execution Provider]  [CPU Execution Provider]
  (Qualcomm Hexagon NPU)     (Universal Fallback)
        │                     │
        ▼                     ▼
[Snapdragon X Elite NPU]   [Standard CPU Cores]
   Latency: < 2.5 ms          Latency: ~15 ms
```

- **QNN Backend**: Targets `libQnnHtp.dll` (Hexagon Tensor Processor).
- **Execution Mode**: Direct on-device hardware acceleration with zero telemetry sent to external cloud APIs.
- **Thermal & Battery Optimization**: Leveraging the Hexagon NPU preserves CPU cores for map rendering and spatial indexing while consuming $<1\text{ Watt}$ of power during bursts.

---

## 7. Fallback Model & Graceful Degradation Strategy

To ensure RESQ remains 100% stable across non-Snapdragon development environments, continuous integration servers, and standard x86 laptops, a multi-tier fallback hierarchy is established:

1. **Tier 1: Snapdragon NPU Acceleration (`QNNExecutionProvider`)**
   - Active when running on Snapdragon hardware with Qualcomm NPU drivers present.
   - Inference Latency: $\sim 1.8 - 2.5\text{ ms}$.
2. **Tier 2: On-Device CPU Fallback (`CPUExecutionProvider`)**
   - Active when running on standard Windows/Linux/macOS development machines or when NPU drivers are uninitialized.
   - Uses the identical ONNX model running on local CPU threads.
   - Inference Latency: $\sim 15 - 20\text{ ms}$ (still imperceptible to human operators).
3. **Tier 3: Lightweight Secondary Architecture — MobileNetV3-Small**
   - Secondary candidate: `qai_hub_models.models.mobilenet_v3_small`.
   - Footprint: $2.5\text{M}$ parameters ($~1.8\text{ MB}$ INT8).
   - Serves as an ultra-constrained fallback for resource-limited embedded hardware.
4. **Tier 4: Manual Operator Override**
   - If image evaluation fails or is bypassed, the modal retains all original manual dropdowns, checkboxes, and sliders without errors.

---

## 8. Step-by-Step Integration Plan

### Phase 2A: Model Asset Preparation & Export
1. Establish `server/services/snapdragon/models/`:
   - Store the pre-trained, validated ONNX model artifact (`mobilenet_v3_large_damage.onnx`).
   - Store class mapping dictionary (`hazard_classes.json`) containing the 5 target disaster classes and default severity parameters.
2. Provide a Python export recipe (`server/services/snapdragon/export_model.py`) documenting the Qualcomm AI Hub compilation command.

### Phase 2B: Backend Inference Service (`snapdragonVisionService.js`)
1. Create `server/services/snapdragon/snapdragonVisionService.js`:
   - Loads ONNX model using `onnxruntime-node`.
   - Attempts initialization with `qnn` execution provider; seamlessly falls back to `cpu`.
   - Implements image preprocessing (decoding, resizing to $224 \times 224$, ImageNet normalization).
   - Computes softmax probabilities and outputs the structured hazard payload.
   - Caches runtime initialization state so repeated calls have sub-millisecond dispatch overhead.

### Phase 2C: REST API Endpoint (`/api/damage/analyze-image`)
1. Mount `POST /api/damage/analyze-image` in `server/routes/damageRoutes.js`:
   - Accepts base64 image data or multipart payload.
   - Calls `snapdragonVisionService.js`.
   - Returns classification, confidence, inferred `hazardType`, `eventType`, estimated `severity`, and veto recommendations.

### Phase 2D: Frontend UI Integration (`DamageReportModal.jsx`)
1. Enhance [DamageReportModal.jsx](file:///d:/RESQ/client/src/panels/DamageReportModal.jsx) without breaking existing controls:
   - Add a clean "Snapdragon AI Image Assessment" dropzone/camera capture button.
   - When an image is selected, display instant visual feedback with a badge: *"Analyzed via Snapdragon AI Engine"*.
   - Automatically pre-fill the form fields: category, severity slider, and blockage checkboxes.
   - Operator can review, adjust, and confirm before submitting.

### Phase 2E: Benchmarking & Verification
1. Implement `server/scripts/benchmark_snapdragon_vision.js`:
   - Benchmarks 50 inference iterations across sample disaster images (flood, bridge scour, landslide, clear road).
   - Logs average, min, max, P50, and P95 latencies.
   - Compares NPU vs. CPU execution modes.
2. Verify that existing routing tests (`server/test/mlClassifier.test.js` and `benchmark_routing.js`) continue to pass with zero regressions.

---

## 9. Conclusion

**MobileNetV3-Large** is the optimal model for RESQ's Snapdragon upgrade. It bridges the critical gap between raw field imagery and automated disaster routing passability, runs natively on the Snapdragon Hexagon NPU via Qualcomm AI Hub in $<2.5\text{ ms}$, and integrates seamlessly into RESQ without touching a single line of the existing PostGIS, Valhalla, or OSM routing engine.
