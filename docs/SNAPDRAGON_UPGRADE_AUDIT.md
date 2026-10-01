# Technical Audit & Snapdragon Upgrade Specification

**Target Platform**: Qualcomm Snapdragon AI Lab (Build & Present Challenge)  
**Project**: RESQ — Damage-Aware Relief Supply Chain Routing (Assam & Meghalaya)  
**Audit Date**: September 2026  
**Document Version**: 1.0.0 — Production Architecture Audit  
**Author**: Antigravity Technical Pair Programmer  

---

## Executive Summary

This technical audit provides a comprehensive, ground-truth inspection of the existing RESQ codebase in preparation for an incremental upgrade for the **Qualcomm Snapdragon AI Lab Build & Present Challenge**.

### Mandatory Invariants Maintained
1. **Core Routing Integrity**: The existing Valhalla road network routing and OSRM fallback engine will not be rewritten or replaced.
2. **PostGIS & 500m Grid Architecture**: The 408,986-cell spatial SSOT (`grid_500m.assam` and `grid_500m.meghalaya`), spatial indexes, metric projections (EPSG:32646 / EPSG:4326), and multi-factor fusion formulas remain strictly authoritative.
3. **UI & Navigation Stability**: The MapLibre GL JS cartography, UI token design system, React 19 layout, and `useResqDrivingMode` turn-by-turn kinematics are preserved without breaking changes.
4. **Incremental Upgrade Philosophy**: All Snapdragon AI capabilities will be introduced as an additive, modular layer with fail-safe fallbacks, preserving 100% backward compatibility when running in standard cloud or non-Snapdragon environments.

---

## 1. Complete Architecture Audit

### 1.1 Frontend Architecture
- **Framework & Tooling**: React 19 (`19.2.8`), Vite 8 (`8.2.2`), React Router DOM v7 (`7.18.3`), Lucide React (`1.37.0`).
- **Cartography & Rendering**: MapLibre GL JS (`4.7.1`) rendering vector basemaps with custom muted cartography tokens (`client/src/styles/tokens.css`). Risk surfaces are rendered via WebGL GPU fill layers with data-driven opacity (`client/src/map/MapSurface.jsx`), ensuring road vectors remain visible under 500m cells.
- **State Management**:
  - `client/src/services/routeStore.js`: Centralized unidirectional state store implementing an observer/listener subscription pattern (`subscribeRouteStore`, `getRouteState`, `emitChange`).
  - Session persistence: Serializes navigation state to browser `localStorage` (`resq_active_navigation_session`) with a 2-hour TTL and automatic hydration upon page refresh.
  - `client/src/app/authContext.jsx`: React Context managing JWT authentication, active session tokens, and role-based access (`ADMIN`, `OPERATOR`, `FIELD_OFFICER`, `CITIZEN`).
- **Turn-by-Turn Driving Engine**:
  - `client/src/navigation/useResqDrivingMode.js`: Coordinates HTML5 Geolocation watching, vehicle marker orientation smoothing (`resqVehicleMarker.js`), camera pitch/bearing follow mode (`resqCameraManager.js`), off-route detection (threshold: 35m sustained for 4,000ms), arrival triggers (35m threshold), and live hazard polling every 3,500ms.
- **Primary Views & Modals**:
  - `client/src/views/MapView.jsx`: Main mission command dashboard featuring interactive multi-hazard layers, route search, and contextual drilldowns.
  - `client/src/views/ResqView.jsx`: Turn-by-turn driving HUD with maneuver instructions, speed/heading display, remaining distance/duration, and live risk re-routing alerts.
  - `client/src/views/ResqTrackView.jsx`: Read-only, real-time tracking dashboard for trusted contacts and emergency dispatchers via shared URL (`/resq/track/:sessionId`).
  - `client/src/views/AdminView.jsx`: Disaster operations console for managing live events, trigger recalibrations, and tracking relief convoy staging.
  - `client/src/panels/ContextPanel.jsx`: Multi-factor risk radar, static/dynamic factor breakdown, nearby emergency assets, and corroborated news items.
  - `client/src/panels/RouteSummaryPanel.jsx`: Comparative side-by-side analysis of Fastest vs. Safe route plans.
  - `client/src/panels/DamageReportModal.jsx`: Field hazard and convoy mission dispatch modal.

### 1.2 Backend Architecture
- **Runtime & Server**: Node.js 20+ (ESM modules), Express 5 (`5.2.1`), HTTP server coupled with Socket.IO (`4.8.3`) for bi-directional real-time events.
- **Entrypoint**: `server/app.js`: Mounts CORS, JSON parsers (10MB payload limit for spatial geometries), registers route controllers, initializes PostgreSQL/PostGIS schemas, and conditionally boots the background RSS news ingestion scheduler (`newsSchedulerService.js`).
- **Database Layer**: `server/config/db.js` wraps `pg.Pool` (`8.23.0`) connecting to PostgreSQL with SSL support and graceful connection error trapping.
- **Service Layer Structure**:
  - `server/services/routing/`: Valhalla adapter, OSRM fallback, route risk evaluator, multi-objective safe ranking, live corridor monitor.
  - `server/services/risk/`: Dynamic risk fusion engine, static composite calculator, and `regionalIntelligenceStore.js` (in-memory offline fallback).
  - `server/services/news/`: RSS feed ingestion, NLP event extraction, NER spatial resolution, spatio-temporal clustering.
  - `server/services/ml/`: In-process disaster text classifier (`disasterClassifierService.js`).
  - `server/services/socketService.js`: Session room streaming (`resq:session:*`), real-time risk alert broadcasts, and SOS emergency alerts.

### 1.3 Database & PostGIS Architecture
- **Engine**: PostgreSQL 14+ with PostGIS 3+ extension.
- **Spatial Resolution & SSOT Tables**:
  - `grid_500m.assam` (317,842 cells) & `grid_500m.meghalaya` (91,144 cells): Total **408,986 polygons** at 500m × 500m resolution in `EPSG:4326` with GiST spatial indexing on `geom`.
  - Columnar Factor Groups:
    - *Identity*: `grid_id`, `state`, `district`, `block`, `center_lat`, `center_lon`, `geom`.
    - *Terrain*: `elevation_mean`, `elevation_min`, `elevation_max`, `slope_mean`.
    - *Hydrology & Geohazard*: `distance_to_river`, `waterbody_percentage`, `flood_susceptibility`, `landslide_susceptibility`, `seismic_risk`.
    - *Exposure*: `population_density`, `infrastructure_exposure`.
    - *Static Composite*: `static_risk` (0.0 to 100.0).
    - *Dynamic Channels*: `rainfall_risk`, `flood_event_risk`, `earthquake_event_risk`, `landslide_event_risk`, `news_risk`, `nlp_event_risk`, `citizen_report_risk`, `road_closure_risk`.
    - *Decision Outputs*: `dynamic_risk`, `risk_score`, `risk_confidence`, `risk_status` (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`), `last_dynamic_update`.
- **Domain Event & Infrastructure Tables**:
  - `disaster.news_events`: Active geolocated hazard events (`POINT(4326)`), flags (`road_blocked`, `bridge_damaged`, `bridge_closed`), severity, confidence, extraction JSON.
  - `disaster.event_grid_links`: Relational spatial attribution linking events to affected cells with distance-decayed `impact_score`.
  - `disaster.event_clusters`: Spatio-temporal corroboration clusters (15km radius, 72-hour window).
  - `infrastructure.roads`: OSM road network with physical passability attributes (`highway`, `surface`, `tracktype`, `maxweight`, `embankment`).
  - `infrastructure.bridges`: Bridge crossing inventory with structure tags and `is_inferred` flags.
  - `datasets.registry`: Cryptographic provenance tracking for every ingested dataset (SHA-256 artifact hashes, source URLs, timestamps).
  - `resq_sessions`: Active user safety sessions, breadcrumb locations, and emergency contacts.
- **High-Resiliency Offline Fallback**:
  - `server/services/risk/regionalIntelligenceStore.js`: Contains hardcoded, verified multi-factor baselines and active disaster zone data for key transport corridors (e.g. NH-27 Boko corridor `AS_00239973`, Jorabat NH-6 junction `AS_00210744`). If PostgreSQL is offline, all endpoints degrade gracefully rather than throwing 500 errors.

### 1.4 Routing Engine Integration
- **Primary Engine**: Valhalla container (`ghcr.io/valhalla/valhalla-scripted:latest`) bound to `127.0.0.1:8002` via `docker-compose.valhalla.yml`.
  - Built from Geofabrik single regional extract: `north-eastern-zone-latest.osm.pbf` (513 routing tiles).
  - Costing profiles mapped in `valhallaService.js`: `car`, `auto`, `ambulance`, `relief_truck`, `4x4`, `water_tanker` all map to automotive routing rules with specific vehicle clearance parameters.
- **Fail-Safe Fallback Router**:
  - `calculateRouteWithOsrmFallback` in `server/services/routing/valhallaService.js`: If Valhalla is offline or returns an error, the system automatically calls public/configured OSRM (`router.project-osrm.org`), extracts GeoJSON geometry, and normalizes maneuvers into the identical RESQ route format (`routingEngine: "osrm-fallback"`).
- **PostGIS 500m Grid Intersection**:
  - `routeRiskService.js` downsamples coordinates if needed (up to 500 sample points) and executes:
    ```sql
    ST_Intersects(g.geom, route_geom)
    ST_LineLocatePoint(route_geom, ST_ClosestPoint(g.geom, route_geom)) AS route_fraction
    ST_DWithin(route_geom::geography, event_geom::geography, 250)
    ```
  - Calculates `meanRisk`, `maxRisk`, `criticalGridCount`, `highRiskGridCount`, `blockedSegmentCount`, and `routeStatus`.
- **Multi-Objective Safe Route Ranking**:
  - `riskAwareRoutingService.js` scores candidates via:
    $$\text{Score} = 0.55 \times \text{NormRisk} + 0.25 \times \min(2.5, \text{DetourRatio}) + 0.20 \times \text{CriticalPenalty}$$
  - Enforces **Hard Block Exclusions**: Any route with `isBlocked === true` or `road_closure_risk >= 80` is rejected or flagged with critical warnings.
  - Automatically generates evidence-based explanations comparing Safe vs. Fastest options.

---

## 2. Existing Data & Operational Flows

### 2.1 Hazard Ingestion & NLP Flow
```
[External Sources]
  ├── 12 Regional RSS Feeds (Sentinel Assam, Shillong Times, NE Now, PIB, ASDMA)
  ├── Manual Operator Submissions (/api/damage/report)
  └── [Future / Sockets] Satellite SAR & USGS Feeds
        │
        ▼
[RSS Ingestion & Deduplication]
  └── news.rss_items (SHA-256 content deduplication)
        │
        ▼
[Rule-Based Keyword Pre-Filter] (nlp/classification/disasterFilter.js)
  └── Regex lexicon score >= 2 (Disaster vs Irrelevant)
        │
        ▼
[In-Process ML Classifier] (server/services/ml/disasterClassifierService.js)
  ├── Sublinear TF-IDF + Logistic Regression (model_v1.json)
  ├── Latency: <0.03 ms
  └── Evaluates: ACTIVE_DISASTER vs NON_ACTIVE (Shadow or Active Gate)
        │
        ▼
[NER Geolocation & Gazetteer Matching] (nlp/location/nerLocationExtractor.js)
  └── Discovers Assam/Meghalaya Districts, Tehsils, River Basins, Bridges
        │
        ▼
[Spatio-Temporal Corroboration] (server/services/news/corroborationService.js)
  └── Clusters reports within 15 km & 72 hours -> Boosts confidence (up to 0.98)
        │
        ▼
[Radial Spatial Buffer Attribution] (newsGeolocationService.js)
  └── ST_DWithin buffer (5 km - 12 km) -> disaster.event_grid_links (distance decay)
        │
        ▼
[Reactive Dynamic Risk Recomputation] (server/services/risk/dynamicRiskService.js)
  ├── Update dynamic factor channels (news_risk, road_closure_risk)
  ├── Safety Floor Escalation: road_closure >= 80 -> dynamic_risk >= 90
  ├── Fusion: risk_score = 0.40 * static_risk + 0.60 * dynamic_risk
  └── Status: CRITICAL, HIGH, MODERATE, LOW
        │
        ▼
[Realtime WebSocket Broadcast & Route Evaluation]
  └── socketService.broadcastSessionUpdate -> routeMonitorService.evaluateGridRiskUpdate
```

### 2.2 Routing & Navigation Flow
```
[User Request] (Origin, Destination, Mode: 'fastest' | 'safe', Vehicle: 'relief_truck')
        │
        ▼
[POST /api/route] (server/routes/routeRoutes.js)
        ├── If mode === 'fastest':
        │     └── valhallaService.calculateRoute (with OSRM fallback)
        │     └── Enrich with routeRiskService.evaluateRouteRisk (500m grid intersection)
        │
        └── If mode === 'safe':
              └── riskAwareRoutingService.calculateSafeRoutePlan
              └── Request 3-5 candidates from Valhalla
              └── Evaluate risk profile for every candidate
              └── Veto blocked routes (bridge collapse / road closure >= 80)
              └── Rank candidates via 0.55*Risk + 0.25*Time + 0.20*Critical
              └── Generate comparative explanation
        │
        ▼
[Client Display] (RouteSummaryPanel.jsx)
  └── Side-by-side comparison: Risk delta, duration delta, avoided hazard breakdown
        │
        ▼
[Start Turn-by-Turn Navigation] (ResqView.jsx + useResqDrivingMode.js)
  └── Register session: POST /api/route/monitor/register
  └── Initialize vehicle tracking, camera heading, step-by-step maneuvers
```

### 2.3 Live Dynamic Rerouting Flow
```
[Convoy In-Transit] (Vehicle moving along approved corridor)
        │
        ├── Client emits GPS updates: POST /api/route/monitor/progress
        └── routeMonitorService trims passed cells: remainingGridIds = remaining corridor only
        │
        ▼
[Hazard Event Occurs Ahead] (New flood report, bridge washout, or manual report)
        │
        ▼
[routeMonitorService.evaluateGridRiskUpdate(gridId)]
        ├── Checks: Is updated gridId in remainingGridIds? (O(1) Set lookup)
        ├── If BEHIND vehicle -> Disregarded (Zero false reroutes)
        ├── If AHEAD on remaining corridor -> Recalculates remaining meanRisk & blocked count
        │
        ▼
[Hysteresis & Reroute Threshold Check]
        ├── Is segment BLOCKED? -> Immediate reroute trigger (damping bypassed)
        ├── Did remaining risk increase by >= 12.0 points? -> Reroute triggered
        └── Cooldown: Minimum 15 seconds between successive reroutes
        │
        ▼
[Alert Operator & Trigger Bypass]
        ├── Client polling (GET /api/route/monitor/:sessionId every 3.5s) detects requiresReroute
        ├── HUD displays prominent alert: "ROUTE RISK CHANGED: Hazard detected ahead"
        ├── Client calls: POST /api/route/reroute (from current GPS coordinates)
        ├── Server executes calculateSafeRoutePlan from current position to destination
        ├── Affected damaged edge excluded; new safe bypass computed
        └── applyReroute updates client geometry, instructions, camera, and HUD banner
```

---

## 3. Existing Benchmark System Audit

The repository contains an empirical, production-grade benchmarking suite:

- **Benchmark Runner Script**: `server/scripts/benchmark_routing.js`
- **Output Artifact**: `routing_benchmark_results.json`
- **Benchmarked Corridor**: Guwahati (Dispur, Assam: `26.1445, 91.7898`) to Shillong (Police Bazar, Meghalaya: `25.5788, 91.8933`) via NH-6 / GS Road (~100 km).
- **In-Transit Waypoints**: Jorabat (15%), Byrnihat (35%), Nongpoh (55%), Umsning (75%), Mawlai (90%).
- **Current Performance Baseline (from `routing_benchmark_results.json`)**:
  - **Core Routing Engine Computation (`calculateRoute` - 50 iterations)**:
    - Average: **380.78 ms**
    - P50 (Median): **326.67 ms**
    - P95: **703.44 ms**
    - Min: **238.75 ms** | Max: **1,616.56 ms**
  - **End-to-End HTTP Route API (`POST /api/routes` with PostGIS 500m grid intersection - 50 iterations)**:
    - Average: **3,883.95 ms**
    - P50: **3,764.98 ms**
    - P95: **4,253.01 ms**
    - Min: **3,488.43 ms** | Max: **7,324.60 ms**
  - **Dynamic In-Transit Rerouting (`POST /api/route/reroute` from active waypoints - 35 iterations)**:
    - Average: **4,108.77 ms**
    - P50: **4,035.66 ms**
    - P95: **4,900.86 ms**
    - Min: **3,411.76 ms** | Max: **7,685.20 ms**
- **Analysis**: The PostGIS spatial intersection (`ST_Intersects` against 400k polygons) and candidate evaluation currently account for ~3.5 seconds of overhead over raw routing graph computation (~380 ms). This provides an ideal optimization target for on-device Snapdragon NPU acceleration!

---

## 4. Existing AI/ML Components Audit

1. **Training Pipeline**:
   - `ml/train.py`: Python script utilizing Scikit-Learn.
   - Text pipeline: Sublinear TF-IDF ($N$-gram $\in [1, 2]$, 2,500 features) + Multinomial Logistic Regression with class weighting.
   - Exports:
     - `ml/models/model_v1.joblib` (Python artifact)
     - `ml/models/model_v1.json` (Serialized parameter dictionary containing classes, vocabulary map, IDF vector, coefficient matrix, and intercept vector).
2. **Inference Runtime**:
   - `server/services/ml/disasterClassifierService.js`: Pure Node.js implementation of linear score dot-product and softmax probability evaluation.
   - **Zero external dependencies**: Does not require Python, ONNX runtime, or child processes in production.
   - **Latency**: $<0.03$ ms per text snippet (>35,000 classifications/sec).
3. **Configuration & Operating Modes**:
   - `ML_CLASSIFIER_MODE` in `server/.env`:
     - `off`: Bypassed completely.
     - `shadow`: Executes parallel inference, logging predictions and metrics without gating active risk.
     - `active`: Conservative gate requiring `ACTIVE_DISASTER` label and confidence $\ge 0.70$ before linking to 500m PostGIS grids.

---

## 5. Existing API Catalog

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/route/health` | Routing engine health & fallback status | No |
| `POST` | `/api/route` | Calculate route (fastest or safe) with 500m risk profile | No |
| `POST` | `/api/routes` | Alias for `/api/route` | No |
| `POST` | `/api/route/monitor/register` | Register active route session for live grid risk monitoring | No |
| `POST` | `/api/route/monitor/progress` | Update vehicle GPS progress & trim passed cells | No |
| `GET` | `/api/route/monitor/:sessionId` | Get monitoring status & upcoming hazards ahead of vehicle | No |
| `POST` | `/api/route/monitor/simulate-risk` | Inject simulated risk update on a cell for live testing | No |
| `POST` | `/api/route/reroute` | Trigger dynamic reroute from current vehicle GPS position | No |
| `DELETE`| `/api/route/monitor/:sessionId` | Cleanup active navigation session | No |
| `GET` | `/api/risk/point?lat=&lon=` | Coordinate risk lookup resolving to 500m cell | No |
| `GET` | `/api/risk/grid/:gridId` | Full multi-factor risk decomposition & active events | No |
| `GET` | `/api/risk/bbox` | Bounding box grid query for map rendering | No |
| `GET` | `/api/risk/zones` | Curated strategic regional risk zones (NH-27, etc.) | No |
| `GET` | `/api/news/sources` | Catalog of monitored RSS feeds | No |
| `GET` | `/api/news/items` | Ingested articles with processing status | No |
| `GET` | `/api/news/events` | Extracted and active disaster events | No |
| `POST` | `/api/news/process` | Trigger batch processing of pending RSS items | Yes (`ADMIN`) |
| `GET` | `/api/geocode?q=` | Forward geocoding with local gazetteer priority | No |
| `GET` | `/api/geocode/reverse?lat=&lon=` | Reverse geocoding resolving authoritative `grid_id` | No |
| `GET` | `/api/damage/reports` | List active field damage reports | Yes (All roles) |
| `POST` | `/api/damage/report` | Submit field damage or road blockage | Yes (`ADMIN`, `OPERATOR`) |
| `DELETE`| `/api/damage/:id` | Resolve and clear damage report | Yes (`ADMIN`) |
| `GET` | `/api/damage/missions` | List active relief supply convoys | Yes (All roles) |
| `POST` | `/api/damage/missions` | Dispatch relief convoy mission | Yes (`ADMIN`, `OPERATOR`) |
| `POST` | `/api/auth/register` | Create user account | No |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | No |
| `GET` | `/api/auth/profile` | Current authenticated user profile | Yes |
| `POST` | `/api/resq/session/start` | Start live RESQ Mode tracking session | Yes |
| `POST` | `/api/resq/session/location` | Telemetry GPS update, grid resolution & socket broadcast | Yes |
| `POST` | `/api/resq/session/sos` | Trigger emergency SOS broadcast | Yes |
| `POST` | `/api/resq/session/end` | Terminate tracking session | Yes |
| `WS` | `join:session`, `leave:session` | Socket.IO room subscriptions | No |
| `WS` | `resq:session:update`, `resq:risk:alert`, `resq:sos:alert` | Real-time WebSocket event streams | No |

---

## 6. Recommended Qualcomm Snapdragon AI Integration Points

To maximize impact for the **Qualcomm Snapdragon AI Lab Build & Present Challenge** while adhering strictly to the non-disruption mandate, we recommend integrating **three complementary on-device AI capabilities** anchored around Snapdragon's NPU, Hexagon processor, and Qualcomm AI Stack:

```
+───────────────────────────────────────────────────────────────────────────────────────────+
|                                QUALCOMM SNAPDRAGON AI LAYER                               |
+───────────────────────────────────────────────────────────────────────────────────────────+
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         ▼                                    ▼                                    ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│       FEATURE 1 (EDGE-CV)    │ │       FEATURE 2 (EDGE-LLM)   │ │      FEATURE 3 (EDGE-NPU)    │
│   Snapdragon On-Device       │ │   Snapdragon Tactical        │ │   On-Device Sub-10ms Grid    │
│   Damage Vision Assessor     │ │   Convoy AI Co-Pilot         │ │   Risk & Passability Engine  │
│                              │ │                              │ │                              │
│ • Runs locally on device NPU │ │ • Quantized on-device SLM    │ │ • Accelerated corridor risk  │
│ • Classifies road washouts,  │ │ • Synthesizes tactical convoy│ │   evaluation via ONNX / NPU  │
│   bridge structural cracks,  │ │   briefings, cargo safety    │ │ • Enables offline in-vehicle │
│   flood submergence depth    │ │   limits, & reroute rationale│ │   reroute decision-making    │
│ • Zero network requirement   │ │ • Replaces static templates  │ │   when cellular towers fail  │
└──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘
```

### Feature 1: Snapdragon On-Device Damage Vision Assessor (Edge-CV)
- **Problem**: Currently, when an operator submits a field damage report via `DamageReportModal.jsx` (`POST /api/damage/report`), they manually enter severity (slider 0-100) and check boxes. In real disaster conditions, field responders have photos/camera feeds but intermittent connectivity.
- **Snapdragon Solution**: Integrate an on-device computer vision classification/segmentation model running on the Snapdragon NPU (via ONNX Runtime / Qualcomm AI Engine / WebNN).
- **Capability**: Responders upload or snap a photo of the damaged road/bridge. The on-device model infers:
  - `damage_type`: `ROAD_WASHOUT`, `BRIDGE_STRUCTURAL_CRACK`, `FLOOD_DEBRIS_SUBMERGENCE`, `LANDSLIDE_DEPOSIT`.
  - `estimated_severity`: `0 - 100`.
  - `closure_recommendation`: `IMPASSABLE` vs `CAUTION_PASSABLE`.
  - `inference_latency`: `< 15 ms` on Snapdragon NPU.

### Feature 2: Snapdragon Tactical Convoy AI Co-Pilot (Edge-LLM / SLM)
- **Problem**: Route explanations generated by `riskAwareRoutingService.js` are static string templates (e.g. *"Diverted around active flood near Boko..."*). They lack deep situational synthesis, cannot assess perishable cargo safety (e.g. insulin cold-chain temperature exposure or blood bag delivery windows), and cannot answer operator conversational queries during transit.
- **Snapdragon Solution**: Integrate a lightweight, on-device Small Language Model (e.g., Llama-3-8B / Phi-3 / Gemma quantized to 4-bit INT4 for Snapdragon Hexagon NPU).
- **Capability**: Generates mission-ready, natural-language tactical briefings:
  - Assesses convoy-specific limits: *"Relief Truck Bravo carrying insulin: Detour adds 14 mins but eliminates a 450m submerged section on NH-27 where water depth exceeds 0.6m axle limit. Insulin cold-pack margin remains safe (+3.2 hrs buffer)."*
  - Works 100% offline inside the vehicle cab on Snapdragon-powered mobile or automotive hardware.

### Feature 3: Snapdragon Accelerated Edge Risk & Passability Evaluator
- **Problem**: The PostGIS corridor intersection takes ~3.8 seconds over the network. In catastrophic disasters (earthquakes/floods), cellular base stations fail, disconnecting the convoy from the backend server.
- **Snapdragon Solution**: Package the corridor risk weights and candidate evaluation matrix into an on-device ONNX runtime model executed directly on Snapdragon hardware.
- **Capability**: Evaluates route safety profiles and dynamic rerouting triggers locally in `< 10 ms` on device, enabling uninterrupted navigation even during complete communications blackouts.

---

## 7. Protected Core vs. Modification Boundaries

To guarantee that RESQ's completed core functionality is never degraded or broken:

### Files That Must NOT Be Modified (PROTECTED INVARIANTS)
| File / Component | Role & Reason for Protection |
|---|---|
| `server/services/routing/valhallaService.js` | Core physical routing graph, polyline6 decoding, Valhalla protocol. |
| `server/services/routing/routeRiskService.js` | Authoritative PostGIS 500m grid intersection and `ST_LineLocatePoint` math. |
| `server/services/routing/riskAwareRoutingService.js` | Multi-objective scoring weights (`0.55/0.25/0.20`) and hard veto rules. |
| `server/services/risk/dynamicRiskService.js` | 408,986-cell reactive fusion formulas (`0.40*Static + 0.60*Dynamic`) and expiry worker. |
| `server/services/risk/compositeRiskService.js` | Zonal static factor formula calculation. |
| `client/src/navigation/useResqDrivingMode.js` | Kinematics, vehicle marker heading, camera follow, off-route math (35m). |
| `client/src/map/MapSurface.jsx` | Core MapLibre GL instance, cartography tokens, and WebGL layer lifecycle. |
| `client/src/styles/tokens.css` | Production cartography and hazard color tokens. |
| `server/config/db.js` | Database connection pool configuration. |
| `docker-compose.valhalla.yml` | Valhalla container configuration. |

### Files That Should Be Modified / Added (INCREMENTAL EXPANSION)
| Action | File Path | Scope of Change |
|---|---|---|
| **[NEW]** | `server/services/snapdragon/` | Snapdragon Edge AI service module (NPU inference bridge, INT4 model runner adapters). |
| **[NEW]** | `client/src/services/snapdragon/` | Client-side Snapdragon AI service (WebNN / ONNX Runtime Web / edge dispatch client). |
| **[NEW]** | `client/src/panels/SnapdragonCoPilotModal.jsx` | Tactical Convoy AI briefing modal and voice/text interaction pane. |
| **[MODIFY]** | `client/src/panels/DamageReportModal.jsx` | Add optional "Snapdragon AI Image Assessment" button with camera capture/upload. |
| **[MODIFY]** | `client/src/panels/RouteSummaryPanel.jsx` | Add "Snapdragon Tactical Briefing" tab displaying on-device co-pilot analysis. |
| **[MODIFY]** | `client/src/views/ResqView.jsx` | Add tactical AI co-pilot status badge to HUD (indicating on-device NPU acceleration). |
| **[MODIFY]** | `server/routes/routeRoutes.js` | Expose optional `/api/route/tactical-briefing` endpoint powered by Snapdragon AI layer. |
| **[MODIFY]** | `server/routes/damageRoutes.js` | Support AI damage assessment metadata tags in `POST /api/damage/report`. |
| **[NEW]** | `server/scripts/benchmark_snapdragon.js` | Benchmark script comparing cloud vs Snapdragon on-device inference latency & throughput. |
| **[NEW]** | `docs/SNAPDRAGON_INTEGRATION_GUIDE.md` | Deployment guide for Snapdragon developer kits and NPU runtime setup. |

---

## 8. Risks of Integration & Mitigation Strategies

| Risk | Severity | Mitigation Strategy |
|---|---|---|
| **1. Target Hardware Dependency**<br>Snapdragon NPU / Hexagon hardware is not present on developer machines or cloud CI servers. | HIGH | **Universal Fallback Adapter**: Implement an adapter pattern. If Snapdragon NPU is detected, route through Qualcomm Hexagon execution provider; otherwise, seamlessly fall back to CPU ONNX Runtime or local quantized Node.js inference without throwing errors. |
| **2. Routing Performance Regression**<br>Calling an AI model during routing introduces latency into the navigation loop. | HIGH | **Asynchronous / Non-Blocking Execution**: Core route computation (`calculateRoute`) and safety vetoes must return immediately. Tactical AI briefings are generated asynchronously and streamed to the HUD without stalling map rendering or maneuver guidance. |
| **3. Memory & Resource Contention**<br>Large LLM models exhausting RAM on edge devices. | MEDIUM | **Model Quantization (INT4)**: Use strictly 4-bit quantized Small Language Models (e.g., Phi-3-mini or MobileLLM, $\le 2$ GB footprint) specifically compiled for Qualcomm Snapdragon NPU. |
| **4. Inconsistent Risk Interpretation**<br>Generative AI hallucinating road conditions. | CRITICAL | **Strict Grounding in PostGIS SSOT**: The AI Co-Pilot is strictly a *summarizer and explainer*, never the mathematical arbitrator. The PostGIS 500m grid risk scores and Valhalla graph remain 100% authoritative; the AI model receives verified structured JSON and is constrained to cite real database evidence. |

---

## 9. Step-by-Step Implementation Plan

### Phase 1: Architecture Validation & Service Skeleton
1. Establish `server/services/snapdragon/` and `client/src/services/snapdragon/` modular directory layout.
2. Implement feature flag `SNAPDRAGON_AI_ENABLED=true` in `server/.env` and `VITE_SNAPDRAGON_AI_ENABLED=true` in `client/.env`.
3. Create mock/universal fallback providers to ensure 100% test pass rate in standard dev environments.

### Phase 2: Edge Vision Damage Assessment (NPU Acceleration)
1. Prepare an ONNX model for road/bridge damage classification and passability assessment.
2. Create client/server bridge in `client/src/services/snapdragon/damageVisionService.js`.
3. Enhance `DamageReportModal.jsx` with photo upload/preview that triggers automatic on-device damage tagging and severity scoring before submission.

### Phase 3: Tactical Convoy AI Co-Pilot (On-Device SLM)
1. Build prompt-engineering and structured grounding pipeline in `server/services/snapdragon/tacticalBriefingService.js`.
2. Format inputs with actual route parameters: vehicle type, cargo constraints, crossed grid counts, avoided hazards, and time delta.
3. Integrate tactical briefing display in `RouteSummaryPanel.jsx` and `ResqView.jsx` HUD.

### Phase 4: Performance Benchmarking & Hardware Validation
1. Create `server/scripts/benchmark_snapdragon.js` comparing:
   - Cloud vs. On-Device Vision Inference latency.
   - Cloud vs. On-Device Tactical Briefing generation latency.
   - Core routing latency before and after integration.
2. Measure and log NPU utilization, memory footprint, and millisecond latencies.
3. Output comparative results to `snapdragon_benchmark_results.json`.

### Phase 5: Documentation & Demonstration Package
1. Produce `docs/SNAPDRAGON_INTEGRATION_GUIDE.md` detailing Qualcomm AI Stack integration.
2. Record interactive demo scenarios (Guwahati -> Shillong relief convoy with bridge failure bypass and tactical briefing).
3. Final verification across all existing test scripts and regression suites.

---

## 10. Audit Conclusion

The RESQ codebase is exceptionally well engineered, highly modular, and production-ready. Its clean decoupling between the physical routing engine (Valhalla), the spatial risk surface (PostGIS 408,986 cells), and the turn-by-turn navigation HUD (React 19) provides the ideal architectural substrate for an incremental, high-impact Snapdragon AI upgrade. 

By integrating on-device multimodal damage assessment and an edge tactical convoy co-pilot without modifying existing core routing algorithms, RESQ will demonstrate a compelling, real-world edge AI capability for disaster relief operations on Qualcomm Snapdragon platforms.
