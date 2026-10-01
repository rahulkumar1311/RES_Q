// Tool 5: find_alternative_route
// Connects directly to existing RESQ risk-aware safe route planning service (riskAwareRoutingService)

import { calculateSafeRoutePlan } from "../../routing/riskAwareRoutingService.js";
import { normalizeCoord } from "../../routing/valhallaService.js";
import { forwardGeocode } from "../../geocoding/resqGeocoderService.js";

async function resolveLocationParam(param, fieldName) {
  if (!param) return null;
  const coord = normalizeCoord(param);
  if (coord) return coord;

  if (typeof param === "string" && param.trim().length > 0) {
    const geoRes = await forwardGeocode(param.trim());
    if (geoRes.success && geoRes.candidates && geoRes.candidates.length > 0) {
      const top = geoRes.candidates[0];
      return {
        lat: Number(top.lat ?? top.latitude),
        lon: Number(top.lon ?? top.longitude),
        name: top.displayName || top.name || param,
      };
    }
    throw new Error(`Location '${param}' for ${fieldName} could not be resolved in gazetteer`);
  }
  return null;
}

export const findAlternativeRouteToolDefinition = {
  name: "find_alternative_route",
  description: "Discovers and evaluates alternative road corridors avoiding known disaster hazard zones and road closures using multi-candidate risk ranking.",
  inputSchema: {
    type: "object",
    required: ["origin", "destination"],
    properties: {
      origin: {
        description: "Starting location coordinates ({lat, lon} or [lon, lat]) or place name string (e.g. 'Guwahati')",
      },
      destination: {
        description: "Destination coordinates ({lat, lon} or [lon, lat]) or place name string (e.g. 'Shillong')",
      },
      vehicle: {
        type: "string",
        default: "car",
        description: "Vehicle costing profile",
      },
      minAlternatives: {
        type: "integer",
        default: 3,
        description: "Number of candidate road branches to evaluate",
      },
    },
  },
  validateInputs(inputs = {}) {
    if (!inputs.origin) return { valid: false, error: "Missing required parameter 'origin'" };
    if (!inputs.destination) return { valid: false, error: "Missing required parameter 'destination'" };
    return { valid: true };
  },
  async handler(inputs = {}) {
    const origin = await resolveLocationParam(inputs.origin, "origin");
    const destination = await resolveLocationParam(inputs.destination, "destination");

    if (!origin || !destination) {
      throw new Error("Invalid origin or destination coordinates");
    }

    const vehicle = inputs.vehicle || "car";
    const alternatives = Math.max(3, parseInt(inputs.minAlternatives, 10) || 3);

    // Call existing RESQ safe route planner
    const planResult = await calculateSafeRoutePlan({
      origin,
      destination,
      mode: "safe",
      vehicle,
      alternatives,
    });

    if (!planResult.success || !planResult.selectedRoute) {
      return {
        success: false,
        hasAlternative: false,
        message: "No alternative physical road corridors found between origin and destination.",
        avoidanceSuccessful: false,
        selectedAlternative: null,
        candidateCount: 0,
      };
    }

    const selected = planResult.selectedRoute;
    const fastest = planResult.fastestRoute || selected;
    const explanation = planResult.explanation || {};

    const isFastestBlocked = Boolean(fastest.riskSnapshot?.isBlocked);
    const isSelectedBlocked = Boolean(selected.riskSnapshot?.isBlocked);
    const avoidedHazards = explanation.avoidedHazards || [];

    const avoidanceSuccessful = !isSelectedBlocked && (isFastestBlocked || avoidedHazards.length > 0);

    return {
      success: true,
      hasAlternative: Boolean(planResult.alternatives && planResult.alternatives.length > 0),
      avoidanceSuccessful,
      explanation: explanation.reason || "Alternative corridor evaluated for minimum disaster vulnerability.",
      avoidedHazardsCount: avoidedHazards.length,
      avoidedHazards,
      riskReductionPoints: explanation.riskReduction || 0,
      extraTimeMinutes: explanation.extraTimeMinutes || 0,
      isBlocked: isSelectedBlocked,
      selectedRoute: {
        routeId: planResult.routeId,
        distanceKm: selected.distanceKm,
        durationMinutes: selected.durationMinutes,
        durationSeconds: selected.durationSeconds,
        meanRiskScore: selected.riskScore,
        riskStatus: selected.riskStatus,
        isBlocked: selected.isBlocked,
        geometry: selected.geometry,
        compositeSafeScore: selected.compositeSafeScore,
      },
      candidateCount: (planResult.alternatives?.length || 0) + 1,
    };
  },
};
