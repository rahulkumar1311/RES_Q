// Tool 4: check_route_safety
// Evaluates route safety against PostGIS 500m risk thresholds and active disaster blockages

import { evaluateRouteRisk, determineRouteSafetyStatus } from "../../routing/routeRiskService.js";

export const checkRouteSafetyToolDefinition = {
  name: "check_route_safety",
  description: "Evaluates the safety of a route candidate against flood submergence, landslide risk, and confirmed physical blockages.",
  inputSchema: {
    type: "object",
    required: ["route"],
    properties: {
      route: {
        type: "object",
        description: "Route object containing geometry coordinates array or precomputed riskSnapshot",
      },
    },
  },
  validateInputs(inputs = {}) {
    if (!inputs.route || typeof inputs.route !== "object") {
      return { valid: false, error: "Missing required parameter 'route' object" };
    }
    const hasGeometry = Array.isArray(inputs.route.geometry) && inputs.route.geometry.length >= 2;
    const hasSnapshot = Boolean(inputs.route.riskSnapshot);
    if (!hasGeometry && !hasSnapshot) {
      return { valid: false, error: "Route object must contain valid geometry array or precomputed riskSnapshot" };
    }
    return { valid: true };
  },
  async handler(inputs = {}) {
    const route = inputs.route;
    let riskEval = null;

    // Use precomputed risk evaluation if already present on route object
    if (route.riskSnapshot && Array.isArray(route.hazards)) {
      riskEval = {
        totalGrids: route.totalGrids || route.routeGridIds?.length || 0,
        riskSnapshot: route.riskSnapshot,
        hazards: route.hazards,
      };
    } else if (Array.isArray(route.geometry)) {
      try {
        riskEval = await evaluateRouteRisk(route.geometry);
      } catch (err) {
        // Data insufficiency rule: If underlying spatial data fails or is unavailable, report UNKNOWN
        return {
          safetyStatus: "UNKNOWN",
          isSafe: false,
          reason: `Hazard data could not be retrieved from spatial database: ${err.message}. Route safety cannot be verified.`,
          detectedHazards: [],
          blockedSegments: 0,
          meanRisk: null,
          dataSufficient: false,
        };
      }
    } else {
      return {
        safetyStatus: "UNKNOWN",
        isSafe: false,
        reason: "Insufficient route spatial geometry to verify safety.",
        detectedHazards: [],
        blockedSegments: 0,
        meanRisk: null,
        dataSufficient: false,
      };
    }

    const snapshot = riskEval.riskSnapshot || {};
    const hazards = riskEval.hazards || [];
    const status = snapshot.routeStatus || determineRouteSafetyStatus(snapshot);

    const isBlocked = Boolean(snapshot.isBlocked);
    const isCritical = status === "CRITICAL" || (snapshot.meanRisk || 0) >= 70;
    const isHighRisk = status === "HIGH_RISK" || (snapshot.meanRisk || 0) >= 45;

    let safetyStatus = "SAFE";
    let isSafe = true;
    let reason = "Route follows verified safe corridor with no active disaster blockages or critical flood hazards.";

    if (isBlocked) {
      safetyStatus = "UNSAFE";
      isSafe = false;
      const blockedRoads = snapshot.affectedRoadCount || 0;
      const blockedBridges = snapshot.affectedBridgeCount || 0;
      reason = `Corridor is physically BLOCKED by active disaster events (${blockedRoads} blocked road segments, ${blockedBridges} closed/damaged bridges).`;
    } else if (isCritical) {
      safetyStatus = "UNSAFE";
      isSafe = false;
      reason = `Corridor traverses CRITICAL risk zones (Mean Risk: ${snapshot.meanRisk}/100, Critical Grids: ${snapshot.criticalGridCount || 0}). High danger of flood inundation or landslide.`;
    } else if (isHighRisk) {
      safetyStatus = "UNSAFE";
      isSafe = false;
      reason = `Corridor enters HIGH RISK sectors (Mean Risk: ${snapshot.meanRisk}/100). Elevated hazard exposure requires caution or alternative corridor.`;
    } else if (status === "CAUTION") {
      safetyStatus = "SAFE";
      isSafe = true;
      reason = `Route is passable under CAUTION (Mean Risk: ${snapshot.meanRisk}/100). Localized minor waterlogging or debris observed.`;
    }

    return {
      safetyStatus, // "SAFE" | "UNSAFE" | "UNKNOWN"
      isSafe,
      routeRiskStatus: status, // "SAFE" | "CAUTION" | "HIGH_RISK" | "CRITICAL" | "BLOCKED"
      reason,
      meanRiskScore: snapshot.meanRisk ?? 0,
      maxRiskScore: snapshot.maxRisk ?? 0,
      isBlocked,
      blockedSegmentCount: snapshot.blockedSegmentCount || 0,
      criticalGridCount: snapshot.criticalGridCount || 0,
      detectedHazards: hazards.map((h) => ({
        id: h.id,
        title: h.title,
        hazardType: h.hazardType,
        severity: h.severity,
        roadBlocked: Boolean(h.roadBlocked),
        bridgeClosed: Boolean(h.bridgeClosed),
        bridgeDamaged: Boolean(h.bridgeDamaged),
        locationText: h.locationText,
        distanceToRouteMeters: h.distanceToRouteMeters,
      })),
      dataSufficient: true,
    };
  },
};
