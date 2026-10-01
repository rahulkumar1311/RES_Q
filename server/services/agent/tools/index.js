// Register all 6 RESQ Agent Tools into ToolRegistry

import { defaultToolRegistry } from "../toolRegistry.js";
import { calculateRouteToolDefinition } from "./calculateRouteTool.js";
import { getHazardDataToolDefinition } from "./getHazardDataTool.js";
import { queryRiskZonesToolDefinition } from "./queryRiskZonesTool.js";
import { checkRouteSafetyToolDefinition } from "./checkRouteSafetyTool.js";
import { findAlternativeRouteToolDefinition } from "./findAlternativeRouteTool.js";
import { compareRoutesToolDefinition } from "./compareRoutesTool.js";

export function registerAllResqTools(registry = defaultToolRegistry) {
  registry.registerTool(calculateRouteToolDefinition);
  registry.registerTool(getHazardDataToolDefinition);
  registry.registerTool(queryRiskZonesToolDefinition);
  registry.registerTool(checkRouteSafetyToolDefinition);
  registry.registerTool(findAlternativeRouteToolDefinition);
  registry.registerTool(compareRoutesToolDefinition);
  return registry;
}

// Automatically register tools on default registry
registerAllResqTools(defaultToolRegistry);

export {
  calculateRouteToolDefinition,
  getHazardDataToolDefinition,
  queryRiskZonesToolDefinition,
  checkRouteSafetyToolDefinition,
  findAlternativeRouteToolDefinition,
  compareRoutesToolDefinition,
};
