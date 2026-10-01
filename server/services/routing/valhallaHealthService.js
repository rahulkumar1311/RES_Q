// Valhalla routing engine health and connectivity service for RESQ backend

const DEFAULT_VALHALLA_URL = "http://127.0.0.1:8002";

// Retrieve the configured Valhalla base URL from environment
export function getValhallaUrl() {
  return process.env.VALHALLA_URL || DEFAULT_VALHALLA_URL;
}

// Check connectivity and operational status of the upstream Valhalla instance or fallback engine
export async function checkValhallaHealth(timeoutMs = 3000) {
  const baseUrl = getValhallaUrl();
  const targetUrl = `${baseUrl.replace(/\/+$/, "")}/status`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        healthy: true,
        statusCode: response.status,
        url: targetUrl,
        engine: "valhalla",
        latencyMs,
        version: data.version,
        tilesetLastModified: data.tileset_last_modified,
        availableActions: data.available_actions || [],
      };
    }
  } catch {
    // Valhalla unavailable, test fallback routing engine
  }

  // Fallback router check (OpenStreetMap / OSRM)
  const osrmUrl = (process.env.OSRM_URL || "https://router.project-osrm.org").replace(/\/+$/, "");
  try {
    const fbStart = Date.now();
    const fbController = new AbortController();
    const fbTimeoutId = setTimeout(() => fbController.abort(), timeoutMs);

    const fbRes = await fetch(`${osrmUrl}/route/v1/driving/91.7898,26.1445;91.7950,26.1418?overview=false`, {
      signal: fbController.signal,
    });
    clearTimeout(fbTimeoutId);

    if (fbRes.ok) {
      return {
        healthy: true,
        statusCode: 200,
        url: osrmUrl,
        engine: "osrm-fallback",
        latencyMs: Date.now() - fbStart,
        valhallaOnline: false,
        fallbackActive: true,
        message: "Valhalla local container offline; automatic OpenStreetMap/OSRM routing engine active.",
      };
    }
  } catch (fbErr) {
    // Both failed
  }

  return {
    healthy: false,
    statusCode: null,
    url: targetUrl,
    engine: "none",
    latencyMs: Date.now() - startTime,
    error: "Valhalla local engine (127.0.0.1:8002) and fallback router unavailable",
  };
}

