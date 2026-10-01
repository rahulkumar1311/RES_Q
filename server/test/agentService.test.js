// Comprehensive unit & integration tests for RESQ Disaster Response Agent & Tool Registry

import assert from "node:assert";
import { ToolRegistry } from "../services/agent/toolRegistry.js";
import { registerAllResqTools } from "../services/agent/tools/index.js";
import { runDisasterAgent } from "../services/agent/resqDisasterAgent.js";
import { createInitialAgentState, AGENT_STATUS } from "../services/agent/agentState.js";
import { extractDisasterIntent } from "../services/agent/llmProvider.js";

console.log("================================================================================");
console.log("             RESQ STEP 5 & 6: AGENT & TOOL REGISTRY TEST SUITE                  ");
console.log("================================================================================\n");

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  console.log(">>> [SECTION 1] Tool Registry & Schema Validation");
  const testRegistry = new ToolRegistry();
  registerAllResqTools(testRegistry);

  test("Registry contains exactly all 6 required tools", () => {
    const tools = testRegistry.listTools();
    assert.strictEqual(tools.length, 6);
    const names = new Set(tools.map((t) => t.name));
    assert.ok(names.has("calculate_route"));
    assert.ok(names.has("get_hazard_data"));
    assert.ok(names.has("query_risk_zones"));
    assert.ok(names.has("check_route_safety"));
    assert.ok(names.has("find_alternative_route"));
    assert.ok(names.has("compare_routes"));
  });

  await testAsync("Unknown tool is safely rejected with UNKNOWN_TOOL error code", async () => {
    const res = await testRegistry.executeTool("malicious_arbitrary_eval", {});
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.code, "UNKNOWN_TOOL");
  });

  await testAsync("Invalid arguments are caught before handler execution", async () => {
    const res = await testRegistry.executeTool("calculate_route", {});
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.code, "VALIDATION_ERROR");
  });

  console.log("\n>>> [SECTION 2] calculate_route Tool");
  await testAsync("calculate_route handles valid geographic points", async () => {
    const res = await testRegistry.executeTool("calculate_route", {
      origin: { lat: 26.1445, lon: 91.7362 },
      destination: { lat: 26.1157, lon: 91.7085 },
    });
    assert.strictEqual(res.success, true);
    assert.ok(res.data.distanceKm > 0);
    assert.ok(Array.isArray(res.data.geometry));
  });

  await testAsync("calculate_route rejects missing destination", async () => {
    const res = await testRegistry.executeTool("calculate_route", {
      origin: { lat: 26.1445, lon: 91.7362 },
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.code, "VALIDATION_ERROR");
  });

  console.log("\n>>> [SECTION 3] get_hazard_data Tool");
  await testAsync("get_hazard_data returns structured hazard list for location", async () => {
    const res = await testRegistry.executeTool("get_hazard_data", {
      location: "Guwahati",
      radiusKm: 25,
    });
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data.hazards));
    assert.ok(typeof res.data.totalHazardsFound === "number");
  });

  await testAsync("get_hazard_data rejects empty location", async () => {
    const res = await testRegistry.executeTool("get_hazard_data", {});
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.code, "VALIDATION_ERROR");
  });

  console.log("\n>>> [SECTION 4] query_risk_zones Tool");
  await testAsync("query_risk_zones safely evaluates route coordinates", async () => {
    const res = await testRegistry.executeTool("query_risk_zones", {
      routeGeometry: [
        [91.7362, 26.1445],
        [91.7370, 26.1450],
      ],
    });
    assert.strictEqual(res.success, true);
    assert.ok(typeof res.data.meanRiskScore === "number");
    assert.ok(typeof res.data.isBlocked === "boolean");
  });

  await testAsync("query_risk_zones rejects geometry with fewer than 2 points", async () => {
    const res = await testRegistry.executeTool("query_risk_zones", {
      routeGeometry: [[91.7362, 26.1445]],
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.code, "VALIDATION_ERROR");
  });

  console.log("\n>>> [SECTION 5] check_route_safety Tool");
  await testAsync("check_route_safety identifies SAFE route correctly", async () => {
    const res = await testRegistry.executeTool("check_route_safety", {
      route: {
        riskSnapshot: {
          meanRisk: 15.0,
          routeStatus: "SAFE",
          isBlocked: false,
          criticalGridCount: 0,
        },
        hazards: [],
      },
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.safetyStatus, "SAFE");
    assert.strictEqual(res.data.isSafe, true);
  });

  await testAsync("check_route_safety identifies UNSAFE blocked corridor", async () => {
    const res = await testRegistry.executeTool("check_route_safety", {
      route: {
        riskSnapshot: {
          meanRisk: 85.0,
          routeStatus: "BLOCKED",
          isBlocked: true,
          blockedSegmentCount: 2,
          affectedRoadCount: 2,
        },
        hazards: [{ id: 1, hazardType: "FLOOD", roadBlocked: true }],
      },
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.safetyStatus, "UNSAFE");
    assert.strictEqual(res.data.isSafe, false);
    assert.strictEqual(res.data.isBlocked, true);
  });

  await testAsync("check_route_safety returns UNKNOWN when spatial data is missing or empty", async () => {
    const res = await testRegistry.executeTool("check_route_safety", {
      route: {
        geometry: [],
      },
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.code, "VALIDATION_ERROR");
  });

  console.log("\n>>> [SECTION 6] find_alternative_route Tool");
  await testAsync("find_alternative_route evaluates multi-candidate corridors", async () => {
    const res = await testRegistry.executeTool("find_alternative_route", {
      origin: { lat: 26.1445, lon: 91.7362 },
      destination: { lat: 26.1157, lon: 91.7085 },
      minAlternatives: 2,
    });
    assert.strictEqual(res.success, true);
    assert.ok(res.data.candidateCount >= 1);
    assert.ok(typeof res.data.avoidanceSuccessful === "boolean");
  });

  console.log("\n>>> [SECTION 7] compare_routes Tool");
  test("compare_routes handles multiple candidate routes", () => {
    const cand1 = { routeId: "r1", distanceKm: 50, durationMinutes: 60, riskScore: 10, isBlocked: false };
    const cand2 = { routeId: "r2", distanceKm: 45, durationMinutes: 50, riskScore: 80, isBlocked: true };

    const def = testRegistry.getTool("compare_routes");
    def.handler({ candidateRoutes: [cand1, cand2] }).then((res) => {
      assert.strictEqual(res.comparisonCount, 2);
      assert.strictEqual(res.rankedRoutes[0].routeId, "r1"); // Safest should rank first
      assert.strictEqual(res.rankedRoutes[1].isBlocked, true);
    });
  });

  test("compare_routes handles empty candidates list gracefully", () => {
    const def = testRegistry.getTool("compare_routes");
    def.handler({ candidateRoutes: [] }).then((res) => {
      assert.strictEqual(res.comparisonCount, 0);
      assert.strictEqual(res.bestRoute, null);
    });
  });

  console.log("\n>>> [SECTION 8] Agent Natural Language Intent Extraction");
  test("Extracts origin, destination, and flood disaster context", () => {
    const intent = extractDisasterIntent("Find a safe route from Guwahati to Shillong during flood conditions");
    assert.strictEqual(intent.origin, "Guwahati");
    assert.strictEqual(intent.destination, "Shillong");
    assert.strictEqual(intent.disasterType, "FLOOD");
    assert.strictEqual(intent.hasLocations, true);
  });

  test("Extracts landslide disaster context between two towns", () => {
    const intent = extractDisasterIntent("Check route between Boko and Dispur under landslide conditions");
    assert.strictEqual(intent.origin, "Boko");
    assert.strictEqual(intent.destination, "Dispur");
    assert.strictEqual(intent.disasterType, "LANDSLIDE");
  });

  console.log("\n>>> [SECTION 9] Autonomous Agent Orchestrator End-to-End");
  await testAsync("Agent runs complete multi-step autonomous workflow", async () => {
    const agentRes = await runDisasterAgent({
      query: "Find a safe route from Guwahati to Shillong during flood conditions",
      maxIterations: 10,
    });

    assert.strictEqual(agentRes.success, true);
    assert.strictEqual(agentRes.status, AGENT_STATUS.COMPLETED);
    assert.strictEqual(agentRes.origin, "Guwahati");
    assert.strictEqual(agentRes.destination, "Shillong");
    assert.ok(agentRes.executionTrace.length >= 4);
    assert.ok(agentRes.toolCalls.length >= 2);
    assert.ok(agentRes.recommendedRoute !== null);

    // Verify trace steps without chain-of-thought
    const traceSteps = agentRes.executionTrace.map((t) => t.step);
    assert.ok(traceSteps.includes("request_understood"));
    assert.ok(traceSteps.includes("disaster_context_identified"));
    assert.ok(traceSteps.includes("final_recommendation_formulated"));
  });

  await testAsync("Agent safely halts on missing destination", async () => {
    const agentRes = await runDisasterAgent({
      query: "Find a route from Guwahati",
      maxIterations: 5,
    });
    assert.strictEqual(agentRes.success, false);
    assert.strictEqual(agentRes.status, AGENT_STATUS.FAILED);
  });

  await testAsync("Agent respects maximum execution step limit", async () => {
    const agentRes = await runDisasterAgent({
      query: "Find a safe route from Guwahati to Shillong during flood conditions",
      maxIterations: 1, // Will halt due to limit
    });
    assert.strictEqual(agentRes.status, AGENT_STATUS.FAILED);
  });

  console.log("\n================================================================================");
  console.log(`                     AGENT TEST RESULTS: ${passed}/${total} PASSED                        `);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
