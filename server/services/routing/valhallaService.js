// Valhalla routing engine integration service for RESQ physical routing

import { getValhallaUrl } from "./valhallaHealthService.js";

// Regional bounding box covering Assam and Meghalaya (Northeast India)
export const REGIONAL_BOUNDS = {
  minLat: 24.0,
  maxLat: 28.5,
  minLon: 89.0,
  maxLon: 97.5,
};

// Maneuver type index to descriptive string name mapping
export const MANEUVER_TYPE_NAMES = {
  0: "None",
  1: "Start",
  2: "StartRight",
  3: "StartLeft",
  4: "Destination",
  5: "DestinationRight",
  6: "DestinationLeft",
  7: "Becomes",
  8: "Continue",
  9: "SlightRight",
  10: "Right",
  11: "SharpRight",
  12: "UturnRight",
  13: "UturnLeft",
  14: "SharpLeft",
  15: "Left",
  16: "SlightLeft",
  17: "RampStraight",
  18: "RampRight",
  19: "RampLeft",
  20: "ExitRight",
  21: "ExitLeft",
  22: "StayStraight",
  23: "StayRight",
  24: "StayLeft",
  25: "Merge",
  26: "RoundaboutEnter",
  27: "RoundaboutExit",
  28: "FerryEnter",
  29: "FerryExit",
  30: "Transit",
  31: "TransitTransfer",
  32: "TransitRemainOn",
  33: "TransitConnectionStart",
  34: "TransitConnectionTransfer",
  35: "TransitConnectionDestination",
  36: "PostTransitConnectionDestination",
  37: "MergeRight",
  38: "MergeLeft",
};

// Supported RESQ vehicle types mapped to Valhalla automotive costing
export const VEHICLE_COSTING_MAP = {
  car: "auto",
  auto: "auto",
  ambulance: "auto",
  relief_truck: "auto",
  "4x4": "auto",
  water_tanker: "auto",
};

// Normalizes coordinate inputs from either [lng, lat] arrays or { lat, lon } objects
export function normalizeCoord(input) {
  if (!input) return null;
  if (Array.isArray(input) && input.length >= 2) {
    const lon = Number(input[0]);
    const lat = Number(input[1]);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  if (typeof input === "object") {
    const lat = Number(input.lat ?? input.latitude);
    const lon = Number(input.lon ?? input.lng ?? input.longitude);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  return null;
}

// Maps Valhalla maneuver type code to visual directional icon identifier
export function getManeuverIcon(type) {
  switch (type) {
    case 1:
    case 2:
    case 3:
      return "start";
    case 4:
    case 5:
    case 6:
      return "destination";
    case 8:
    case 22:
      return "straight";
    case 9:
    case 10:
    case 11:
    case 18:
    case 20:
    case 23:
      return "right";
    case 14:
    case 15:
    case 16:
    case 19:
    case 21:
    case 24:
      return "left";
    case 12:
    case 13:
      return "uturn";
    case 25:
    case 37:
      return "merge_right";
    case 38:
      return "merge_left";
    case 26:
    case 27:
      return "roundabout";
    default:
      return "straight";
  }
}

// Checks if a coordinate falls inside the regional Northeast India routing bounds
export function isWithinRegionalCoverage(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  return (
    lat >= REGIONAL_BOUNDS.minLat &&
    lat <= REGIONAL_BOUNDS.maxLat &&
    lon >= REGIONAL_BOUNDS.minLon &&
    lon <= REGIONAL_BOUNDS.maxLon
  );
}

// Decodes a Valhalla Polyline6 string into GeoJSON [longitude, latitude] coordinates
export function decodePolyline6(str) {
  if (!str || typeof str !== "string") return [];
  let index = 0;
  const len = str.length;
  let lat = 0;
  let lon = 0;
  const coordinates = [];

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlon = result & 1 ? ~(result >> 1) : result >> 1;
    lon += dlon;

    // GeoJSON coordinate order: [longitude, latitude]
    coordinates.push([lon / 1e6, lat / 1e6]);
  }

  return coordinates;
}

// Normalizes maneuvers from a Valhalla trip leg
function normalizeManeuvers(maneuvers = []) {
  return maneuvers.map((m) => ({
    type: m.type,
    typeName: MANEUVER_TYPE_NAMES[m.type] || "Maneuver",
    icon: getManeuverIcon(m.type),
    instruction: m.instruction || "",
    verbalInstruction:
      m.verbal_transition_alert_instruction ||
      m.verbal_pre_transition_instruction ||
      m.verbal_succinct_transition_instruction ||
      m.instruction ||
      "",
    streetNames: m.street_names || [],
    distanceKm: typeof m.length === "number" ? Math.round(m.length * 1000) / 1000 : 0,
    durationSeconds: typeof m.time === "number" ? Math.round(m.time) : 0,
    beginShapeIndex: m.begin_shape_index ?? 0,
    endShapeIndex: m.end_shape_index ?? 0,
  }));
}

// Normalizes a raw Valhalla trip object into a consistent RESQ route structure
function normalizeTrip(trip) {
  if (!trip || !trip.legs || !trip.legs.length) {
    throw new Error("Invalid trip object structure from Valhalla");
  }

  const primaryLeg = trip.legs[0];
  const geometry = decodePolyline6(primaryLeg.shape || "");
  const instructions = normalizeManeuvers(primaryLeg.maneuvers || []);

  const summary = {
    hasTolls: Boolean(trip.summary?.has_toll),
    hasHighway: Boolean(trip.summary?.has_highway),
    hasFerry: Boolean(trip.summary?.has_ferry),
    hasTimeRestrictions: Boolean(trip.summary?.has_time_restrictions),
  };

  const boundingBox = {
    minLat: trip.summary?.min_lat ?? null,
    minLon: trip.summary?.min_lon ?? null,
    maxLat: trip.summary?.max_lat ?? null,
    maxLon: trip.summary?.max_lon ?? null,
  };

  const distanceKm =
    typeof trip.summary?.length === "number"
      ? Math.round(trip.summary.length * 100) / 100
      : 0;

  const durationSeconds =
    typeof trip.summary?.time === "number"
      ? Math.round(trip.summary.time)
      : 0;

  const durationMinutes = Math.round(durationSeconds / 60);

  return {
    distanceKm,
    durationSeconds,
    durationMinutes,
    geometry,
    summary,
    boundingBox,
    instructions,
  };
}

// Request and calculate route from upstream Valhalla server
export async function calculateRoute({
  origin,
  destination,
  mode = "fastest",
  vehicle = "car",
  units = "kilometers",
  alternatives = 2,
  timeoutMs = 5000,
}) {
  // Normalize and validate origin and destination coordinates
  const normOrigin = normalizeCoord(origin);
  const normDest = normalizeCoord(destination);

  if (!normOrigin) {
    const err = new Error("Invalid or missing origin coordinates");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  if (!normDest) {
    const err = new Error("Invalid or missing destination coordinates");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  if (normOrigin.lat < -90 || normOrigin.lat > 90 || normOrigin.lon < -180 || normOrigin.lon > 180) {
    const err = new Error("Origin coordinates out of valid geographic range");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  if (normDest.lat < -90 || normDest.lat > 90 || normDest.lon < -180 || normDest.lon > 180) {
    const err = new Error("Destination coordinates out of valid geographic range");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  // Route mode validation
  const normalizedMode = String(mode).toLowerCase();
  if (normalizedMode === "safe" || normalizedMode === "balanced") {
    const err = new Error(
      `Route mode '${mode}' will be enabled in the Risk-Aware Routing Layer. Only 'fastest' physical routing is active currently.`
    );
    err.code = "MODE_NOT_IMPLEMENTED";
    err.status = 501;
    throw err;
  }

  if (normalizedMode !== "fastest" && normalizedMode !== "car" && normalizedMode !== "auto") {
    const err = new Error(`Unsupported route mode '${mode}'. Supported modes: fastest, car.`);
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    throw err;
  }

  // Vehicle mapping
  const normalizedVehicle = String(vehicle).toLowerCase();
  const costingProfile = VEHICLE_COSTING_MAP[normalizedVehicle] || "auto";
  const clampedAlternatives = Math.max(0, Math.min(4, parseInt(alternatives, 10) || 0));

  // Gracefully handle identical or co-located origin and destination (distance < 5m)
  const latDiff = Math.abs(normOrigin.lat - normDest.lat);
  const lonDiff = Math.abs(normOrigin.lon - normDest.lon);
  if (latDiff < 0.00005 && lonDiff < 0.00005) {
    const routeId = `resq_arrival_${Date.now()}`;
    return {
      success: true,
      routingEngine: "resq-arrival",
      routeId,
      mode: normalizedMode === "car" ? "car" : "fastest",
      vehicle: {
        type: normalizedVehicle,
        costingProfile,
      },
      latencyMs: 0,
      route: {
        distanceKm: 0,
        durationSeconds: 0,
        durationMinutes: 0,
        geometry: [
          [normOrigin.lon, normOrigin.lat],
          [normDest.lon, normDest.lat],
        ],
        summary: {
          hasTolls: false,
          hasHighway: false,
          hasFerry: false,
          hasTimeRestrictions: false,
        },
        boundingBox: {
          minLat: normOrigin.lat,
          minLon: normOrigin.lon,
          maxLat: normDest.lat,
          maxLon: normDest.lon,
        },
        instructions: [
          {
            type: 4,
            typeName: "Destination",
            icon: "destination",
            instruction: "You are already at your destination.",
            verbalInstruction: "You have arrived at your destination.",
            streetNames: [],
            distanceKm: 0,
            durationSeconds: 0,
            beginShapeIndex: 0,
            endShapeIndex: 1,
          },
        ],
      },
      alternatives: [],
    };
  }

  // Regional bounding coverage check
  const originInside = isWithinRegionalCoverage(normOrigin.lat, normOrigin.lon);
  const destInside = isWithinRegionalCoverage(normDest.lat, normDest.lon);


  // If outside regional extract, directly use the global fallback routing engine
  if (!originInside || !destInside) {
    console.info(
      "[ROUTING] Coordinates outside Assam-Meghalaya local tileset. Using OpenStreetMap fallback router."
    );
    return await calculateRouteWithOsrmFallback({
      origin: normOrigin,
      destination: normDest,
      mode: normalizedMode,
      vehicle: normalizedVehicle,
      units,
      alternatives: clampedAlternatives,
    });
  }

  // Build Valhalla request payload
  const valhallaPayload = {
    locations: [
      { lat: normOrigin.lat, lon: normOrigin.lon, type: "break" },
      { lat: normDest.lat, lon: normDest.lon, type: "break" },
    ],
    costing: costingProfile,
    alternates: clampedAlternatives,
    directions_options: {
      units: units === "miles" ? "miles" : "kilometers",
      language: "en-US",
    },
  };

  const baseUrl = getValhallaUrl();
  const targetUrl = `${baseUrl.replace(/\/+$/, "")}/route`;
  const startTime = Date.now();

  let response;
  let useFallback = false;
  let fallbackReason = "";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    response = await fetch(targetUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(valhallaPayload),
    });

    clearTimeout(timeoutId);
  } catch (netErr) {
    console.warn(
      `[ROUTING] Valhalla engine at ${targetUrl} unavailable (${netErr.message}). Engaging OpenStreetMap routing fallback.`
    );
    useFallback = true;
    fallbackReason = netErr.message;
  }

  if (useFallback || (response && !response.ok && response.status >= 500)) {
    try {
      return await calculateRouteWithOsrmFallback({
        origin: normOrigin,
        destination: normDest,
        mode: normalizedMode,
        vehicle: normalizedVehicle,
        units,
        alternatives: clampedAlternatives,
      });
    } catch (fbErr) {
      const err = new Error(
        `Routing engine unavailable: Valhalla (${fallbackReason || response?.status}) and fallback both failed: ${fbErr.message}`
      );
      err.code = "ROUTING_ENGINE_UNAVAILABLE";
      err.status = 503;
      throw err;
    }
  }

  const rawText = await response.text();
  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
    const err = new Error("Invalid response format from routing engine");
    err.code = "ROUTING_ENGINE_ERROR";
    err.status = 502;
    throw err;
  }

  if (!response.ok || !json.trip) {
    // If Valhalla returned a 404 or 400, try fallback once as well
    try {
      return await calculateRouteWithOsrmFallback({
        origin: normOrigin,
        destination: normDest,
        mode: normalizedMode,
        vehicle: normalizedVehicle,
        units,
        alternatives: clampedAlternatives,
      });
    } catch {
      const statusMsg = json.status_message || json.error || "No route found";
      const err = new Error(statusMsg);
      err.code = json.error_code === 171 || response.status === 400 ? "ROUTE_NOT_FOUND" : "ROUTING_ENGINE_ERROR";
      err.status = response.status === 400 ? 404 : response.status;
      err.upstreamCode = json.error_code;
      throw err;
    }
  }

  const latencyMs = Date.now() - startTime;
  const primaryRoute = normalizeTrip(json.trip);

  // Normalize alternatives if present
  const normalizedAlternatives = Array.isArray(json.alternates)
    ? json.alternates.map((alt, idx) => ({
        alternativeIndex: idx + 1,
        ...normalizeTrip(alt.trip),
      }))
    : [];

  const routeId = `resq_route_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return {
    success: true,
    routingEngine: "valhalla",
    routeId,
    mode: normalizedMode === "car" ? "car" : "fastest",
    vehicle: {
      type: normalizedVehicle,
      costingProfile,
    },
    latencyMs,
    route: primaryRoute,
    alternatives: normalizedAlternatives,
  };
}

// Fallback route computation using OpenStreetMap / OSRM public routing API
export async function calculateRouteWithOsrmFallback({
  origin,
  destination,
  mode = "fastest",
  vehicle = "car",
  units = "kilometers",
  alternatives = 2,
  timeoutMs = 8000,
}) {
  const osrmBaseUrl = (process.env.OSRM_URL || "https://router.project-osrm.org").replace(/\/+$/, "");
  const startTime = Date.now();

  const numAlts = Math.max(0, Math.min(3, parseInt(alternatives, 10) || 0));
  const altParam = numAlts > 0 ? `&alternatives=${numAlts > 1 ? 3 : "true"}` : "";
  const requestUrl = `${osrmBaseUrl}/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=true${altParam}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(requestUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const error = new Error(`Routing fallback engine unavailable at ${osrmBaseUrl}: ${err.message}`);
    error.code = "ROUTING_ENGINE_UNAVAILABLE";
    error.status = 503;
    throw error;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const error = new Error(`Routing fallback engine returned HTTP ${response.status}`);
    error.code = "ROUTING_ENGINE_ERROR";
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  if (data.code !== "Ok" || !Array.isArray(data.routes) || data.routes.length === 0) {
    const error = new Error(data.message || "No route found between given coordinates");
    error.code = "ROUTE_NOT_FOUND";
    error.status = 404;
    throw error;
  }

  const normalizeOsrmRoute = (osrmRoute) => {
    const rawCoords = osrmRoute.geometry?.coordinates || [];
    const distanceKm = Math.round((osrmRoute.distance / 1000) * 100) / 100;
    const durationSeconds = Math.round(osrmRoute.duration);
    const durationMinutes = Math.round(durationSeconds / 60);

    // Bounding box
    let minLat = 90;
    let maxLat = -90;
    let minLon = 180;
    let maxLon = -180;
    for (const [lon, lat] of rawCoords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }

    const boundingBox =
      rawCoords.length > 0
        ? { minLat, minLon, maxLat, maxLon }
        : { minLat: null, minLon: null, maxLat: null, maxLon: null };

    // Steps to instructions
    const steps = osrmRoute.legs?.[0]?.steps || [];
    let shapeOffset = 0;
    const instructions = steps.map((step) => {
      const stepCoordCount = step.geometry?.coordinates?.length || 0;
      const beginShapeIndex = shapeOffset;
      const endShapeIndex = stepCoordCount > 0 ? shapeOffset + stepCoordCount - 1 : shapeOffset;
      shapeOffset = endShapeIndex;

      const maneuverType = step.maneuver?.type || "";
      const modifier = step.maneuver?.modifier || "";
      const streetName = step.name || "";
      const streetNames = streetName ? [streetName] : [];

      let typeCode = 8;
      let typeName = "Continue";
      let icon = "straight";
      let instructionText = streetName ? `Continue on ${streetName}` : "Continue straight";

      if (maneuverType === "depart") {
        typeCode = 1;
        typeName = "Start";
        icon = "start";
        instructionText = streetName ? `Depart on ${streetName}` : "Start journey";
      } else if (maneuverType === "arrive") {
        typeCode = 4;
        typeName = "Destination";
        icon = "destination";
        instructionText = "Arrive at your destination";
      } else if (
        maneuverType === "roundabout" ||
        maneuverType === "rotary" ||
        maneuverType === "roundabout turn"
      ) {
        typeCode = 26;
        typeName = "RoundaboutEnter";
        icon = "roundabout";
        instructionText = streetName
          ? `Enter roundabout and take exit onto ${streetName}`
          : "Enter roundabout";
      } else if (maneuverType === "merge") {
        if (modifier.includes("left")) {
          typeCode = 38;
          typeName = "MergeLeft";
          icon = "merge_left";
          instructionText = streetName ? `Merge left onto ${streetName}` : "Merge left";
        } else {
          typeCode = 37;
          typeName = "MergeRight";
          icon = "merge_right";
          instructionText = streetName ? `Merge right onto ${streetName}` : "Merge right";
        }
      } else if (maneuverType === "on ramp" || maneuverType === "ramp") {
        if (modifier.includes("right")) {
          typeCode = 18;
          typeName = "RampRight";
          icon = "right";
          instructionText = streetName ? `Take the ramp on the right onto ${streetName}` : "Take ramp right";
        } else if (modifier.includes("left")) {
          typeCode = 19;
          typeName = "RampLeft";
          icon = "left";
          instructionText = streetName ? `Take the ramp on the left onto ${streetName}` : "Take ramp left";
        } else {
          typeCode = 17;
          typeName = "RampStraight";
          icon = "straight";
          instructionText = streetName ? `Take the ramp onto ${streetName}` : "Take ramp";
        }
      } else if (maneuverType === "off ramp") {
        if (modifier.includes("left")) {
          typeCode = 21;
          typeName = "ExitLeft";
          icon = "left";
          instructionText = streetName ? `Take exit on the left onto ${streetName}` : "Take exit left";
        } else {
          typeCode = 20;
          typeName = "ExitRight";
          icon = "right";
          instructionText = streetName ? `Take exit on the right onto ${streetName}` : "Take exit right";
        }
      } else if (modifier.includes("uturn")) {
        typeCode = 12;
        typeName = "UturnRight";
        icon = "uturn";
        instructionText = streetName ? `Make a U-turn onto ${streetName}` : "Make a U-turn";
      } else if (modifier.includes("sharp right")) {
        typeCode = 11;
        typeName = "SharpRight";
        icon = "right";
        instructionText = streetName ? `Make a sharp right onto ${streetName}` : "Sharp right";
      } else if (modifier.includes("sharp left")) {
        typeCode = 14;
        typeName = "SharpLeft";
        icon = "left";
        instructionText = streetName ? `Make a sharp left onto ${streetName}` : "Sharp left";
      } else if (modifier.includes("slight right")) {
        typeCode = 9;
        typeName = "SlightRight";
        icon = "right";
        instructionText = streetName ? `Bear slight right onto ${streetName}` : "Slight right";
      } else if (modifier.includes("slight left")) {
        typeCode = 16;
        typeName = "SlightLeft";
        icon = "left";
        instructionText = streetName ? `Bear slight left onto ${streetName}` : "Slight left";
      } else if (modifier.includes("right")) {
        typeCode = 10;
        typeName = "Right";
        icon = "right";
        instructionText = streetName ? `Turn right onto ${streetName}` : "Turn right";
      } else if (modifier.includes("left")) {
        typeCode = 15;
        typeName = "Left";
        icon = "left";
        instructionText = streetName ? `Turn left onto ${streetName}` : "Turn left";
      } else if (maneuverType === "new name") {
        typeCode = 7;
        typeName = "Becomes";
        icon = "straight";
        instructionText = streetName ? `Road becomes ${streetName}` : "Continue straight";
      }

      return {
        type: typeCode,
        typeName,
        icon,
        instruction: instructionText,
        verbalInstruction: instructionText,
        streetNames,
        distanceKm: typeof step.distance === "number" ? Math.round((step.distance / 1000) * 1000) / 1000 : 0,
        durationSeconds: typeof step.duration === "number" ? Math.round(step.duration) : 0,
        beginShapeIndex,
        endShapeIndex,
      };
    });

    return {
      distanceKm: units === "miles" ? Math.round(distanceKm * 0.621371 * 100) / 100 : distanceKm,
      durationSeconds,
      durationMinutes,
      geometry: rawCoords,
      summary: {
        hasTolls: false,
        hasHighway: false,
        hasFerry: false,
        hasTimeRestrictions: false,
      },
      boundingBox,
      instructions,
    };
  };

  const primaryRoute = normalizeOsrmRoute(data.routes[0]);
  const normalizedAlternatives = data.routes.slice(1).map((alt, idx) => ({
    alternativeIndex: idx + 1,
    ...normalizeOsrmRoute(alt),
  }));

  const latencyMs = Date.now() - startTime;
  const routeId = `resq_osrm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return {
    success: true,
    routingEngine: "osrm-fallback",
    routeId,
    mode: mode === "car" ? "car" : "fastest",
    vehicle: {
      type: vehicle,
      costingProfile: VEHICLE_COSTING_MAP[vehicle] || "auto",
    },
    latencyMs,
    route: primaryRoute,
    alternatives: normalizedAlternatives,
  };
}

