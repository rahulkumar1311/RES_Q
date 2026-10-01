// Tool 2: get_hazard_data
// Connects directly to existing RESQ hazard services (PostGIS disaster.news_events with Regional Store fallback)

import pool from "../../../config/db.js";
import { REGIONAL_ZONES } from "../../risk/regionalIntelligenceStore.js";
import { forwardGeocode } from "../../geocoding/resqGeocoderService.js";
import { normalizeCoord } from "../../routing/valhallaService.js";

// Helper: Haversine distance in km
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const getHazardDataToolDefinition = {
  name: "get_hazard_data",
  description: "Retrieves active disaster events, road blockages, bridge closures, and flood/landslide hazards within a geographic radius.",
  inputSchema: {
    type: "object",
    required: ["location"],
    properties: {
      location: {
        description: "Geographic coordinate ({lat, lon} or [lon, lat]) or place/district name string (e.g. 'Guwahati', 'Nongpoh')",
      },
      hazardType: {
        type: "string",
        description: "Optional filter for hazard type (e.g. 'FLOOD', 'LANDSLIDE', 'ROAD_BLOCKAGE', 'BRIDGE_DAMAGE')",
      },
      radiusKm: {
        type: "number",
        default: 30,
        description: "Search radius in kilometers around location (default: 30 km)",
      },
    },
  },
  validateInputs(inputs = {}) {
    if (!inputs.location) {
      return { valid: false, error: "Missing required parameter 'location'" };
    }
    return { valid: true };
  },
  async handler(inputs = {}) {
    let targetLat = null;
    let targetLon = null;
    let locationName = "";

    const coord = normalizeCoord(inputs.location);
    if (coord) {
      targetLat = coord.lat;
      targetLon = coord.lon;
      locationName = `${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}`;
    } else if (typeof inputs.location === "string" && inputs.location.trim().length > 0) {
      const geoRes = await forwardGeocode(inputs.location.trim());
      if (geoRes.success && geoRes.candidates && geoRes.candidates.length > 0) {
        const top = geoRes.candidates[0];
        targetLat = Number(top.lat ?? top.latitude);
        targetLon = Number(top.lon ?? top.longitude);
        locationName = top.displayName || top.name || inputs.location;
      } else {
        throw new Error(`Location '${inputs.location}' could not be resolved`);
      }
    } else {
      throw new Error("Invalid location argument");
    }

    const radiusKm = Math.max(1, Math.min(100, Number(inputs.radiusKm) || 30));
    const radiusMeters = radiusKm * 1000;
    const filterType = inputs.hazardType ? String(inputs.hazardType).toUpperCase() : null;

    let hazards = [];
    let dataSource = "postgis_disaster_events";

    // Attempt querying PostgreSQL PostGIS
    try {
      const client = await pool.connect();
      try {
        const query = `
          SELECT 
            id,
            COALESCE(location_text, event_type) AS title,
            event_type,
            hazard_type,
            severity,
            road_blocked,
            bridge_damaged,
            bridge_closed,
            location_text,
            latitude,
            longitude,
            ROUND(ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric, 1) AS distance_meters
          FROM disaster.news_events
          WHERE event_status = 'ACTIVE'
            AND (valid_until IS NULL OR valid_until > NOW())
            AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
          ORDER BY distance_meters ASC
          LIMIT 50;
        `;
        const res = await client.query(query, [targetLon, targetLat, radiusMeters]);
        hazards = (res.rows || []).map((row) => ({
          id: row.id,
          title: row.title,
          eventType: row.event_type,
          hazardType: row.hazard_type,
          severity: parseFloat(row.severity) || 70,
          roadBlocked: Boolean(row.road_blocked),
          bridgeDamaged: Boolean(row.bridge_damaged),
          bridgeClosed: Boolean(row.bridge_closed),
          locationText: row.location_text,
          lat: parseFloat(row.latitude),
          lon: parseFloat(row.longitude),
          distanceKm: Math.round((parseFloat(row.distance_meters) / 1000) * 10) / 10,
        }));
      } finally {
        client.release();
      }
    } catch (dbErr) {
      // Fallback to verified regional intelligence store
      dataSource = "regional_intelligence_store";
      const collected = [];
      for (const zone of REGIONAL_ZONES) {
        const distKm = calculateDistanceKm(targetLat, targetLon, zone.centerLat, zone.centerLon);
        if (distKm <= radiusKm) {
          for (const ev of zone.activeEvents || []) {
            collected.push({
              id: ev.id,
              title: ev.news_title || ev.location_text,
              eventType: ev.event_type,
              hazardType: ev.hazard_type,
              severity: parseFloat(ev.severity) || 75,
              roadBlocked: Boolean(ev.road_blocked),
              bridgeDamaged: Boolean(ev.bridge_damaged),
              bridgeClosed: Boolean(ev.bridge_closed),
              locationText: ev.location_text || `${zone.name}, ${zone.state}`,
              lat: ev.latitude || zone.centerLat,
              lon: ev.longitude || zone.centerLon,
              distanceKm: Math.round(distKm * 10) / 10,
            });
          }
        }
      }
      hazards = collected;
    }

    // Apply hazard type filter if requested
    if (filterType) {
      hazards = hazards.filter(
        (h) =>
          (h.hazardType && h.hazardType.toUpperCase().includes(filterType)) ||
          (h.eventType && h.eventType.toUpperCase().includes(filterType))
      );
    }

    return {
      location: { lat: targetLat, lon: targetLon, name: locationName },
      radiusKm,
      dataSource,
      totalHazardsFound: hazards.length,
      blockedRoadsCount: hazards.filter((h) => h.roadBlocked).length,
      closedBridgesCount: hazards.filter((h) => h.bridgeClosed || h.bridgeDamaged).length,
      hazards,
    };
  },
};
