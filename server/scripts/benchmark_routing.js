// RESQ Production Routing & Rerouting Latency Benchmark Suite
// Measures actual runtime metrics across realistic Assam/Meghalaya corridors
// Zero mocked timings, zero fabricated data.

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure benchmark port
process.env.PORT = process.env.BENCHMARK_PORT || "5098";
const BENCHMARK_PORT = parseInt(process.env.PORT, 10);
const BASE_URL = `http://127.0.0.1:${BENCHMARK_PORT}`;

// Realistic geographic corridor: Guwahati, Assam -> Shillong, Meghalaya (NH-6 / GS Road)
const ORIGIN = { lat: 26.1445, lon: 91.7898 };       // Dispur, Guwahati
const DESTINATION = { lat: 25.5788, lon: 91.8933 };  // Police Bazar, Shillong

// Realistic intermediate progress waypoints along NH-6 corridor for in-transit rerouting
const WAYPOINTS = [
  { name: "Jorabat Junction", lat: 26.1012, lon: 91.8682, progress: 0.15 },
  { name: "Byrnihat Border", lat: 25.9922, lon: 91.8845, progress: 0.35 },
  { name: "Nongpoh Central", lat: 25.9038, lon: 91.8805, progress: 0.55 },
  { name: "Umsning Bypass", lat: 25.7510, lon: 91.8860, progress: 0.75 },
  { name: "Mawlai Gateway", lat: 25.6025, lon: 91.8920, progress: 0.90 },
];

// Helper to make HTTP POST requests and measure exact network + processing latency
function httpPostJson(urlStr, payload) {
  const url = new URL(urlStr);
  const data = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const tStart = performance.now();
    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          const tEnd = performance.now();
          const elapsedMs = tEnd - tStart;
          try {
            const parsed = JSON.parse(body);
            resolve({
              statusCode: res.statusCode,
              data: parsed,
              elapsedMs,
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              raw: body,
              error: e.message,
              elapsedMs,
            });
          }
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// Statistical calculation helper for count, avg, min, max, P50, P95
function calculateStats(latencies) {
  if (!latencies || latencies.length === 0) {
    return { count: 0, average: 0, min: 0, max: 0, p50: 0, p95: 0, raw: [] };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const average = sum / n;
  const min = sorted[0];
  const max = sorted[n - 1];

  // P50 (Median)
  let p50;
  if (n % 2 === 1) {
    p50 = sorted[Math.floor(n / 2)];
  } else {
    p50 = (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  }

  // P95 (Nearest-rank method: ceil(0.95 * n) - 1 in 0-indexed array)
  const p95Index = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
  const p95 = sorted[p95Index];

  return {
    count: n,
    average: Number(average.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    p50: Number(p50.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    raw: sorted.map((v) => Number(v.toFixed(2))),
  };
}

async function runBenchmark() {
  console.log("================================================================================");
  console.log("                     RESQ PERFORMANCE BENCHMARK SUITE                           ");
  console.log("================================================================================");
  console.log(`Corridor: Guwahati Dispur [${ORIGIN.lat}, ${ORIGIN.lon}] -> Shillong [${DESTINATION.lat}, ${DESTINATION.lon}]`);
  console.log(`Vehicle Profile: car (costing: auto)`);
  console.log(`Environment: Node.js ${process.version}, Port: ${BENCHMARK_PORT}`);
  console.log("--------------------------------------------------------------------------------\n");

  // Dynamically import Express app and services
  const { default: app } = await import("../app.js");
  const { checkValhallaHealth } = await import("../services/routing/valhallaHealthService.js");
  const { calculateRoute } = await import("../services/routing/valhallaService.js");

  // Health check verification
  console.log("Step 0: Checking Routing Engine & Health Status...");
  const health = await checkValhallaHealth();
  console.log(`   Engine: ${health.engine}`);
  console.log(`   Valhalla Online: ${Boolean(health.valhallaOnline)}`);
  console.log(`   Fallback Active: ${Boolean(health.fallbackActive)}`);
  console.log(`   Upstream Health: ${health.healthy ? "HEALTHY (HTTP " + health.statusCode + ")" : "UNHEALTHY"}\n`);

  // ---------------------------------------------------------------------------
  // BENCHMARK PART 1A: CORE ROUTING ENGINE COMPUTATION (50 Iterations)
  // Direct in-process execution of calculateRoute (Valhalla probe + OSRM fallback + geometry decoding)
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("TEST 1A: Core Routing Engine Latency (calculateRoute - 50 Iterations)");
  console.log("================================================================================");
  const coreEngineLatencies = [];

  for (let i = 1; i <= 50; i++) {
    const tStart = performance.now();
    const result = await calculateRoute({
      origin: [ORIGIN.lon, ORIGIN.lat],
      destination: [DESTINATION.lon, DESTINATION.lat],
      mode: "fastest",
      vehicle: "car",
    });
    const tEnd = performance.now();
    const duration = tEnd - tStart;

    if (result.success && result.route) {
      coreEngineLatencies.push(duration);
      if (i % 10 === 0 || i === 1 || i === 50) {
        console.log(`   [Run ${String(i).padStart(2, " ")}/50] ${duration.toFixed(2)} ms | Distance: ${result.route.distanceKm} km | Geometry: ${result.route.geometry.length} pts`);
      }
    } else {
      console.error(`   [Run ${i}/50] FAILED:`, result);
    }
  }

  const coreStats = calculateStats(coreEngineLatencies);
  console.log("\n--- Core Routing Engine Stats (50 Runs) ---");
  console.log(`   Tests:   ${coreStats.count}`);
  console.log(`   Average: ${coreStats.average} ms`);
  console.log(`   Min:     ${coreStats.min} ms`);
  console.log(`   Max:     ${coreStats.max} ms`);
  console.log(`   P50:     ${coreStats.p50} ms`);
  console.log(`   P95:     ${coreStats.p95} ms\n`);

  // ---------------------------------------------------------------------------
  // BENCHMARK PART 1B: END-TO-END HTTP API ROUTE COMPUTATION (50 Iterations)
  // Full HTTP pipeline: POST /api/routes (Validation -> Valhalla -> OSRM -> PostGIS -> JSON response)
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("TEST 1B: End-to-End Route Computation API (POST /api/routes - 50 Iterations)");
  console.log("================================================================================");
  const apiRouteLatencies = [];

  for (let i = 1; i <= 50; i++) {
    const payload = {
      origin: ORIGIN,
      destination: DESTINATION,
      mode: "fastest",
      vehicle: "car",
      alternatives: 0,
    };

    const response = await httpPostJson(`${BASE_URL}/api/routes`, payload);

    if (response.statusCode === 200 && response.data?.success) {
      apiRouteLatencies.push(response.elapsedMs);
      if (i % 10 === 0 || i === 1 || i === 50) {
        console.log(`   [Run ${String(i).padStart(2, " ")}/50] ${response.elapsedMs.toFixed(2)} ms | Status: ${response.statusCode} | Distance: ${response.data.route?.distanceKm} km`);
      }
    } else {
      console.error(`   [Run ${i}/50] FAILED: HTTP ${response.statusCode}`, response.data);
    }
  }

  const apiRouteStats = calculateStats(apiRouteLatencies);
  console.log("\n--- End-to-End Route Computation Stats (50 Runs) ---");
  console.log(`   Tests:   ${apiRouteStats.count}`);
  console.log(`   Average: ${apiRouteStats.average} ms`);
  console.log(`   Min:     ${apiRouteStats.min} ms`);
  console.log(`   Max:     ${apiRouteStats.max} ms`);
  console.log(`   P50:     ${apiRouteStats.p50} ms`);
  console.log(`   P95:     ${apiRouteStats.p95} ms\n`);

  // ---------------------------------------------------------------------------
  // BENCHMARK PART 2: DYNAMIC REROUTE LATENCY (35 Iterations)
  // Complete pipeline: Session Registration -> GPS In-Transit Progress -> Dynamic Reroute Request
  // Measures end-to-end time from reroute trigger until complete updated route plan is generated.
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("TEST 2: Dynamic Reroute Pipeline (POST /api/routes/reroute - 35 Iterations)");
  console.log("================================================================================");
  const rerouteLatencies = [];
  const TOTAL_REROUTE_TESTS = 35;

  // Initial baseline route calculation to establish base geometry
  const initialRouteRes = await httpPostJson(`${BASE_URL}/api/routes`, {
    origin: ORIGIN,
    destination: DESTINATION,
    mode: "fastest",
    vehicle: "car",
  });

  const baseGeometry = initialRouteRes.data?.route?.geometry || [
    [ORIGIN.lon, ORIGIN.lat],
    [DESTINATION.lon, DESTINATION.lat],
  ];

  for (let i = 1; i <= TOTAL_REROUTE_TESTS; i++) {
    const sessionId = `bench_sess_${Date.now()}_${i}`;
    const wp = WAYPOINTS[(i - 1) % WAYPOINTS.length];
    const currentVehiclePos = [wp.lon, wp.lat];

    // 1. Register Active Navigation Session
    const regRes = await httpPostJson(`${BASE_URL}/api/routes/monitor/register`, {
      sessionId,
      routeId: `route_base_${i}`,
      routeGeometry: baseGeometry,
      origin: [ORIGIN.lon, ORIGIN.lat],
      destination: [DESTINATION.lon, DESTINATION.lat],
      vehicle: "car",
    });

    if (regRes.statusCode !== 200 || !regRes.data?.success) {
      console.error(`   [Reroute ${i}] Registration failed:`, regRes.data);
      continue;
    }

    // 2. Update Vehicle Progress along Corridor
    await httpPostJson(`${BASE_URL}/api/routes/monitor/progress`, {
      sessionId,
      currentPosition: currentVehiclePos,
      progressFraction: wp.progress,
    });

    // 3. Trigger Dynamic Reroute from Current Vehicle Location
    const rerouteRes = await httpPostJson(`${BASE_URL}/api/routes/reroute`, {
      sessionId,
      currentPosition: currentVehiclePos,
    });

    if (rerouteRes.statusCode === 200 && rerouteRes.data?.success) {
      rerouteLatencies.push(rerouteRes.elapsedMs);
      if (i % 7 === 0 || i === 1 || i === TOTAL_REROUTE_TESTS) {
        console.log(`   [Reroute ${String(i).padStart(2, " ")}/${TOTAL_REROUTE_TESTS}] ${rerouteRes.elapsedMs.toFixed(2)} ms | Waypoint: ${wp.name} (${(wp.progress * 100).toFixed(0)}%) | Version: ${rerouteRes.data.routeVersion} | New Dist: ${rerouteRes.data.newRoute?.distanceKm} km`);
      }
    } else {
      console.error(`   [Reroute ${i}] FAILED: HTTP ${rerouteRes.statusCode}`, rerouteRes.data);
    }

    // 4. Clean up session
    await new Promise((resolve) => {
      const req = http.request(new URL(`${BASE_URL}/api/routes/monitor/${sessionId}`), { method: "DELETE" }, resolve);
      req.on("error", resolve);
      req.end();
    });
  }

  const rerouteStats = calculateStats(rerouteLatencies);
  console.log("\n--- Dynamic Reroute Stats (35 Runs) ---");
  console.log(`   Tests:   ${rerouteStats.count}`);
  console.log(`   Average: ${rerouteStats.average} ms`);
  console.log(`   Min:     ${rerouteStats.min} ms`);
  console.log(`   Max:     ${rerouteStats.max} ms`);
  console.log(`   P50:     ${rerouteStats.p50} ms`);
  console.log(`   P95:     ${rerouteStats.p95} ms\n`);

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("                     RESQ PERFORMANCE BENCHMARK SUMMARY                         ");
  console.log("================================================================================");
  console.log(`
RESQ PERFORMANCE BENCHMARK

Route Computation (Core Physical Engine - calculateRoute):
- Tests: ${coreStats.count}
- Average: ${coreStats.average} ms
- Min: ${coreStats.min} ms
- Max: ${coreStats.max} ms
- P50: ${coreStats.p50} ms
- P95: ${coreStats.p95} ms

Route Computation (End-to-End API Pipeline - POST /api/routes):
- Tests: ${apiRouteStats.count}
- Average: ${apiRouteStats.average} ms
- Min: ${apiRouteStats.min} ms
- Max: ${apiRouteStats.max} ms
- P50: ${apiRouteStats.p50} ms
- P95: ${apiRouteStats.p95} ms

Rerouting (Live Dynamic Pipeline - POST /api/routes/reroute):
- Tests: ${rerouteStats.count}
- Average: ${rerouteStats.average} ms
- Min: ${rerouteStats.min} ms
- Max: ${rerouteStats.max} ms
- P50: ${rerouteStats.p50} ms
- P95: ${rerouteStats.p95} ms
`);

  // Persist benchmark results to file
  const resultsPayload = {
    benchmarkDate: new Date().toISOString(),
    environment: {
      platform: process.platform,
      nodeVersion: process.version,
      routingEngine: health.engine,
      valhallaOnline: health.valhallaOnline,
      fallbackActive: health.fallbackActive,
      corridor: {
        name: "Guwahati (Assam) to Shillong (Meghalaya) via NH-6",
        origin: ORIGIN,
        destination: DESTINATION,
        vehicle: "car",
      },
    },
    metrics: {
      coreRouteComputation: coreStats,
      apiRouteComputation: apiRouteStats,
      dynamicRerouting: rerouteStats,
    },
  };

  const outputPath = path.resolve(__dirname, "../../routing_benchmark_results.json");
  fs.writeFileSync(outputPath, JSON.stringify(resultsPayload, null, 2), "utf8");
  console.log(`Benchmark raw measurements and metadata saved to: ${outputPath}`);
  console.log("================================================================================\n");

  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed with error:", err);
  process.exit(1);
});
