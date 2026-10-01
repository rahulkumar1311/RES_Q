// Tool 1: calculate_route
// Connects directly to existing RESQ physical routing engine (Valhalla with OSRM fallback)

import { calculateRoute, normalizeCoord } from "../../routing/valhallaService.js";
import { forwardGeocode } from "../../geocoding/resqGeocoderService.js";

async function resolveLocationParam(param, fieldName) {
  if (!param) return null;
  // If already coordinate object or array
  const coord = normalizeCoord(param);
  if (coord) return coord;

  // If string name passed (e.g., "Guwahati", "Shillong"), resolve via existing geocoder
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

export const calculateRouteToolDefinition = {
  name: "calculate_route",
  description: "Calculates a physical road route between origin and destination coordinates or place names using RESQ routing engine.",
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
      mode: {
        type: "string",
        enum: ["fastest", "car"],
        default: "fastest",
        description: "Route calculation optimization profile",
      },
      vehicle: {
        type: "string",
        enum: ["car", "auto", "ambulance", "relief_truck", "4x4", "water_tanker"],
        default: "car",
        description: "Vehicle class costing profile",
      },
      alternatives: {
        type: "integer",
        minimum: 0,
        maximum: 3,
        default: 2,
        description: "Number of alternative route options to request",
      },
    },
  },
  validateInputs(inputs = {}) {
    if (!inputs.origin) {
      return { valid: false, error: "Missing required parameter 'origin'" };
    }
    if (!inputs.destination) {
      return { valid: false, error: "Missing required parameter 'destination'" };
    }
    return { valid: true };
  },
  async handler(inputs = {}) {
    const origin = await resolveLocationParam(inputs.origin, "origin");
    const destination = await resolveLocationParam(inputs.destination, "destination");

    if (!origin) {
      const err = new Error("Invalid or unresolvable origin coordinates");
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (!destination) {
      const err = new Error("Invalid or unresolvable destination coordinates");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const mode = inputs.mode === "car" ? "car" : "fastest";
    const vehicle = inputs.vehicle || "car";
    const alternatives = inputs.alternatives !== undefined ? parseInt(inputs.alternatives, 10) : 2;

    const result = await calculateRoute({
      origin,
      destination,
      mode,
      vehicle,
      alternatives,
    });

    if (!result.success || !result.route) {
      const err = new Error(result.error?.message || "Routing engine could not calculate path");
      err.code = result.error?.code || "ROUTING_FAILED";
      throw err;
    }

    return {
      routeId: result.routeId,
      routingEngine: result.routingEngine,
      origin: { lat: origin.lat, lon: origin.lon, name: origin.name },
      destination: { lat: destination.lat, lon: destination.lon, name: destination.name },
      distanceKm: result.route.distanceKm,
      durationMinutes: result.route.durationMinutes,
      durationSeconds: result.route.durationSeconds,
      geometry: result.route.geometry,
      instructionsCount: result.route.instructions?.length || 0,
      alternativesCount: result.alternatives?.length || 0,
      alternatives: (result.alternatives || []).map((alt, idx) => ({
        alternativeIndex: alt.alternativeIndex || idx + 1,
        distanceKm: alt.distanceKm,
        durationMinutes: alt.durationMinutes,
        durationSeconds: alt.durationSeconds,
        geometry: alt.geometry,
      })),
    };
  },
};
