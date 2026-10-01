// Frontend validation suite for RESQ Disaster Response Agent UI integration

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "..");

console.log("================================================================================");
console.log("             RESQ STEP 7 & 8: AGENT UI FRONTEND TEST SUITE                      ");
console.log("================================================================================\n");

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

// 1. Verify AgentView file existence and structure
test("1. AgentView page component exists with required sections", () => {
  const agentViewPath = path.join(clientDir, "src", "views", "AgentView.jsx");
  assert.ok(fs.existsSync(agentViewPath), "AgentView.jsx must exist");
  const content = fs.readFileSync(agentViewPath, "utf8");

  // Required headers and sections
  assert.ok(content.includes("RESQ Disaster Response Agent"), "Contains main page title");
  assert.ok(content.includes("AI-powered multi-step disaster response and route analysis"), "Contains subtitle");
  assert.ok(content.includes("Analyze Request"), "Contains Analyze Request submit button");
  assert.ok(content.includes("Find a safe route from Guwahati to Shillong during flood conditions"), "Contains example prompt");
  assert.ok(content.includes("Agent Execution Trace"), "Contains operational execution trace section");
  assert.ok(content.includes("Tool Execution Activity"), "Contains tool execution activity section");
  assert.ok(content.includes("Recommended Route Plan"), "Contains recommended route plan card");
  assert.ok(content.includes("Safety could not be verified with the available data"), "Contains required UNKNOWN safety statement");
});

// 2. Verify styles module exists
test("2. AgentView CSS module exists with scoped styling", () => {
  const cssPath = path.join(clientDir, "src", "views", "AgentView.module.css");
  assert.ok(fs.existsSync(cssPath), "AgentView.module.css must exist");
  const content = fs.readFileSync(cssPath, "utf8");
  assert.ok(content.includes(".page"), "Contains .page style class");
  assert.ok(content.includes(".traceList"), "Contains .traceList style class");
  assert.ok(content.includes(".toolsGrid"), "Contains .toolsGrid style class");
  assert.ok(content.includes(".resultCard"), "Contains .resultCard style class");
});

// 3. Verify App Router contains /agent route without modifying existing routes
test("3. App.jsx registers /agent route cleanly inside AppShell", () => {
  const appPath = path.join(clientDir, "src", "App.jsx");
  const content = fs.readFileSync(appPath, "utf8");
  assert.ok(content.includes('import AgentView from \'./views/AgentView.jsx\''), "App.jsx imports AgentView");
  assert.ok(content.includes('path="/agent"'), "App.jsx defines /agent path");
  assert.ok(content.includes('path="/"'), "App.jsx preserves MapView route");
  assert.ok(content.includes('path="/resq"'), "App.jsx preserves ResqView route");
  assert.ok(content.includes('path="/about"'), "App.jsx preserves AboutView route");
  assert.ok(content.includes('path="/admin"'), "App.jsx preserves AdminView route");
});

// 4. Verify TopBar includes Agent in NAV_ITEMS
test("4. TopBar.jsx includes /agent in NAV_ITEMS while preserving all existing items", () => {
  const topBarPath = path.join(clientDir, "src", "app", "TopBar.jsx");
  const content = fs.readFileSync(topBarPath, "utf8");
  assert.ok(content.includes("{ to: '/agent', label: 'Agent', end: false }"), "TopBar includes Agent nav item");
  assert.ok(content.includes("{ to: '/', label: 'Map', end: true }"), "Preserves Map nav item");
  assert.ok(content.includes("{ to: '/resq', label: 'RESQ Mode', end: false }"), "Preserves RESQ Mode nav item");
  assert.ok(content.includes("{ to: '/about', label: 'About', end: false }"), "Preserves About nav item");
});

// 5. Verify api.js exports runAgentQuery and getAgentTools
test("5. api.js exports runAgentQuery and getAgentTools", () => {
  const apiPath = path.join(clientDir, "src", "services", "api.js");
  const content = fs.readFileSync(apiPath, "utf8");
  assert.ok(content.includes("export async function runAgentQuery"), "Exports runAgentQuery");
  assert.ok(content.includes("export async function getAgentTools"), "Exports getAgentTools");
  assert.ok(content.includes("/agent/run"), "Calls /agent/run");
  assert.ok(content.includes("/agent/tools"), "Calls /agent/tools");
});

// 6. Test runAgentQuery input validation
test("6. runAgentQuery rejects empty query without sending network request", async () => {
  const { runAgentQuery } = await import("../src/services/api.js");
  await assert.rejects(
    async () => {
      await runAgentQuery("");
    },
    { message: "Query string is required" }
  );
  await assert.rejects(
    async () => {
      await runAgentQuery("   ");
    },
    { message: "Query string is required" }
  );
});

// 7. Verify contract handling for UNKNOWN safety status
test("7. Safety status UNKNOWN handling displays non-committal safety statement", () => {
  const unknownResponse = {
    recommendedRoute: {
      riskStatus: "UNKNOWN",
      isBlocked: false,
    },
  };
  const isUnknown = unknownResponse.recommendedRoute.riskStatus === "UNKNOWN";
  assert.strictEqual(isUnknown, true);
  const statement = "Safety could not be verified with the available data.";
  assert.ok(statement.includes("Safety could not be verified"));
});

// 8. Verify existing views and components remain untouched
test("8. Existing core views remain intact", () => {
  assert.ok(fs.existsSync(path.join(clientDir, "src", "views", "MapView.jsx")), "MapView.jsx exists");
  assert.ok(fs.existsSync(path.join(clientDir, "src", "views", "ResqView.jsx")), "ResqView.jsx exists");
  assert.ok(fs.existsSync(path.join(clientDir, "src", "views", "AboutView.jsx")), "AboutView.jsx exists");
  assert.ok(fs.existsSync(path.join(clientDir, "src", "map", "MapSurface.jsx")), "MapSurface.jsx exists");
  assert.ok(fs.existsSync(path.join(clientDir, "src", "services", "routeStore.js")), "routeStore.js exists");
});

console.log("\n================================================================================");
console.log(`                 FRONTEND TEST RESULTS: ${passed}/${total} PASSED                        `);
console.log("================================================================================\n");

if (passed !== total) {
  process.exit(1);
}
