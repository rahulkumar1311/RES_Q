// LLM Provider abstraction with configurable remote provider & deterministic fallback planner
// Enables tool-calling when API keys are supplied and deterministic multi-step planning when offline

import { ASSAM_DISTRICTS, MEGHALAYA_DISTRICTS } from "../../../nlp/location/nerLocationExtractor.js";

/**
 * Extracts origin, destination, and disaster context from natural language emergency requests
 */
export function extractDisasterIntent(query = "") {
  const text = String(query || "").trim();
  const lower = text.toLowerCase();

  let origin = null;
  let destination = null;
  let disasterType = "GENERAL_HAZARD";

  // Identify disaster context
  if (lower.includes("flood") || lower.includes("submerg") || lower.includes("waterlog") || lower.includes("inundat")) {
    disasterType = "FLOOD";
  } else if (lower.includes("landslide") || lower.includes("mudslide") || lower.includes("rockfall")) {
    disasterType = "LANDSLIDE";
  } else if (lower.includes("bridge") || lower.includes("scour") || lower.includes("collapse")) {
    disasterType = "BRIDGE_DAMAGE";
  } else if (lower.includes("block") || lower.includes("closure")) {
    disasterType = "ROAD_BLOCKAGE";
  }

  // Helper to clean extracted location strings from noise words and phonetic typos
  function cleanLocation(str) {
    if (!str) return null;
    let s = String(str)
      .replace(/^(?:find|search|get|give|check|calculate|plan|show|navigate|evacuate|take|me)\s+/i, "")
      .replace(/^(?:a\s+|the\s+)/i, "")
      .replace(/^(?:safe|safest|alternative|emergency|best|quickest|fastest)\s+/i, "")
      .replace(/^(?:route|root|routes|roots|path|corridor|transit|directions|navigation)\s+/i, "")
      .replace(/^(?:from|between)\s+/i, "")
      .replace(/\s+(?:during|in|avoiding|with|under|underneath|due\s+to|amid|conditions|now|safely|please).*$/i, "")
      .replace(/[^\w\s\-]/g, " ")
      .trim();
    return s.length >= 2 ? s : null;
  }

  // Pattern 1: Explicit "from <Origin> to <Destination>"
  const fromToMatch = text.match(/from\s+([A-Za-z0-9\s\-]+?)\s+(?:to|->|towards)\s+([A-Za-z0-9\s\-]+?)(?:\s+(?:during|in|avoiding|with|under|due\s+to)|$|\.|\,)/i);
  if (fromToMatch) {
    origin = cleanLocation(fromToMatch[1]);
    destination = cleanLocation(fromToMatch[2]);
  }

  // Pattern 2: "between <Origin> and <Destination>"
  if (!origin || !destination) {
    const betweenMatch = text.match(/between\s+([A-Za-z0-9\s\-]+?)\s+and\s+([A-Za-z0-9\s\-]+?)(?:\s+(?:during|in|avoiding|with|under|due\s+to)|$|\.|\,)/i);
    if (betweenMatch) {
      origin = cleanLocation(betweenMatch[1]);
      destination = cleanLocation(betweenMatch[2]);
    }
  }

  // Pattern 3: Generalized natural phrasing: "[optional prefix] <Origin> to <Destination>" (e.g. "find safe root jamui to patna")
  if (!origin || !destination) {
    const directToMatch = text.match(/(?:(?:find|search|get|check|calculate|plan|show|navigate)\s+)?(?:(?:safe|safest|alternative|emergency|best)\s+)?(?:(?:route|root|path|corridor|transit)\s+)?([A-Za-z0-9\s\-]{2,30}?)\s+(?:to|->|towards)\s+([A-Za-z0-9\s\-]{2,30}?)(?:\s+(?:during|in|avoiding|with|under|due\s+to|underneath)|$|\.|\,)/i);
    if (directToMatch) {
      origin = cleanLocation(directToMatch[1]);
      destination = cleanLocation(directToMatch[2]);
    }
  }

  // Pattern 4: Separator based "<Origin> - <Destination>" or "<Origin> / <Destination>"
  if (!origin || !destination) {
    const sepMatch = text.match(/([A-Za-z0-9\s]{2,25})\s*(?:[-–—/])\s*([A-Za-z0-9\s]{2,25})/);
    if (sepMatch) {
      origin = cleanLocation(sepMatch[1]);
      destination = cleanLocation(sepMatch[2]);
    }
  }

  // Scan against regional & pan-India district/town dictionaries if not cleanly extracted
  if (!origin || !destination) {
    const knownPlaces = [
      ...ASSAM_DISTRICTS,
      ...MEGHALAYA_DISTRICTS,
      // Major national and regional cities
      "Guwahati", "Dispur", "Shillong", "Nongpoh", "Jorabat", "Boko", "Saraighat", "Tezpur", "Silchar",
      "Patna", "Jamui", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia", "Begusarai",
      "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar",
      "Kolkata", "Howrah", "Siliguri", "Asansol", "Durgapur",
      "Delhi", "New Delhi", "Noida", "Gurugram", "Faridabad", "Ghaziabad",
      "Mumbai", "Pune", "Nagpur", "Thane", "Nashik",
      "Bengaluru", "Bangalore", "Mysuru", "Mangalore", "Hubli",
      "Hyderabad", "Secunderabad", "Warangal", "Visakhapatnam", "Vijayawada",
      "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem",
      "Ahmedabad", "Surat", "Vadodara", "Rajkot",
      "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer",
      "Lucknow", "Kanpur", "Varanasi", "Prayagraj", "Agra", "Meerut", "Bareilly",
      "Bhopal", "Indore", "Jabalpur", "Gwalior",
      "Chandigarh", "Amritsar", "Ludhiana", "Jalandhar",
      "Bhubaneswar", "Cuttack", "Rourkela", "Puri",
      "Dehradun", "Haridwar", "Rishikesh", "Shimla", "Srinagar", "Jammu"
    ];

    const found = [];
    for (const place of knownPlaces) {
      const idx = lower.indexOf(place.toLowerCase());
      if (idx !== -1) {
        found.push({ name: place, index: idx });
      }
    }
    found.sort((a, b) => a.index - b.index);

    if (found.length >= 2) {
      if (!origin) origin = found[0].name;
      if (!destination) destination = found[1].name;
    } else if (found.length === 1) {
      if (!origin) origin = found[0].name;
    }
  }

  // Final hygiene pass
  origin = cleanLocation(origin);
  destination = cleanLocation(destination);

  return {
    origin: origin || null,
    destination: destination || null,
    disasterType,
    hasLocations: Boolean(origin && destination),
  };
}

/**
 * Executes an LLM reasoning or deterministic agent decision step
 */
export async function planNextAgentAction(state, availableTools = []) {
  const { toolCalls, candidateRoutes, hazards, status } = state;
  const toolCallNames = new Set(toolCalls.map((t) => t.tool));

  // If remote LLM provider configured with API key
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const provider = process.env.LLM_PROVIDER || "openai";

  if (apiKey) {
    try {
      return await callExternalLlmPlanner({ state, availableTools, apiKey, provider });
    } catch (llmErr) {
      console.warn(`[AGENT] Remote LLM provider failed (${llmErr.message}). Engaging deterministic disaster agent planner.`);
    }
  }

  // Deterministic Goal-Driven Disaster Agent Planner
  // Step 1: If no hazard data gathered yet, call get_hazard_data
  if (!toolCallNames.has("get_hazard_data")) {
    return {
      action: "CALL_TOOL",
      tool: "get_hazard_data",
      inputs: {
        location: state.origin || "Guwahati",
        hazardType: state.disasterType,
        radiusKm: 40,
      },
      reasoning: "Gathering active regional hazard data and disaster bulletins around transit corridor.",
    };
  }

  // Step 2: If no route calculated yet, call calculate_route
  if (!toolCallNames.has("calculate_route")) {
    return {
      action: "CALL_TOOL",
      tool: "calculate_route",
      inputs: {
        origin: state.origin,
        destination: state.destination,
        mode: "fastest",
        vehicle: "car",
        alternatives: 2,
      },
      reasoning: "Calculating baseline physical road route between origin and destination.",
    };
  }

  // Find the primary route result
  const primaryRouteCall = toolCalls.find((t) => t.tool === "calculate_route" && t.status === "completed");
  const primaryRoute = primaryRouteCall?.data || (candidateRoutes.length > 0 ? candidateRoutes[0] : null);

  // Step 3: If route calculated, but risk zones not queried, call query_risk_zones
  if (!toolCallNames.has("query_risk_zones") && primaryRoute?.geometry) {
    return {
      action: "CALL_TOOL",
      tool: "query_risk_zones",
      inputs: {
        routeGeometry: primaryRoute.geometry,
        bufferMeters: 250,
      },
      reasoning: "Intersecting route geometry with PostGIS 500m risk grid to detect crossed hazard zones.",
    };
  }

  // Step 4: If safety check not performed yet on primary route, call check_route_safety
  if (!toolCallNames.has("check_route_safety") && primaryRoute) {
    const riskZoneCall = toolCalls.find((t) => t.tool === "query_risk_zones" && t.status === "completed");
    const routeToEvaluate = {
      ...primaryRoute,
      riskSnapshot: riskZoneCall?.data
        ? {
            meanRisk: riskZoneCall.data.meanRiskScore,
            maxRisk: riskZoneCall.data.maxRiskScore,
            routeStatus: riskZoneCall.data.routeRiskStatus,
            isBlocked: riskZoneCall.data.isBlocked,
            blockedSegmentCount: riskZoneCall.data.blockedSegmentCount,
            criticalGridCount: riskZoneCall.data.criticalGridCount,
            highRiskGridCount: riskZoneCall.data.highRiskGridCount,
            affectedBridgeCount: riskZoneCall.data.affectedBridgeCount,
            affectedRoadCount: riskZoneCall.data.affectedRoadCount,
          }
        : primaryRoute.riskSnapshot,
      hazards: riskZoneCall?.data?.activeCorridorHazards || primaryRoute.hazards || [],
    };
    return {
      action: "CALL_TOOL",
      tool: "check_route_safety",
      inputs: {
        route: routeToEvaluate,
      },
      reasoning: "Evaluating route safety profile against flood inundation thresholds and infrastructure closures.",
    };
  }

  // Check the safety result
  const safetyCall = toolCalls.find((t) => t.tool === "check_route_safety" && t.status === "completed");
  const safetyData = safetyCall?.data || {};
  const isUnsafe = safetyData.safetyStatus === "UNSAFE" || safetyData.isBlocked || !safetyData.isSafe;

  // Step 5: If unsafe and alternative not yet sought, RE-PLAN and call find_alternative_route
  if (isUnsafe && !toolCallNames.has("find_alternative_route")) {
    return {
      action: "CALL_TOOL",
      tool: "find_alternative_route",
      inputs: {
        origin: state.origin,
        destination: state.destination,
        vehicle: "car",
        minAlternatives: 3,
      },
      reasoning: "Primary route detected as UNSAFE. Re-planning to find alternative corridors bypassing active hazard zones.",
    };
  }

  // Step 6: If candidate routes exist, call compare_routes
  if (!toolCallNames.has("compare_routes") && candidateRoutes.length > 0) {
    return {
      action: "CALL_TOOL",
      tool: "compare_routes",
      inputs: {
        candidateRoutes: candidateRoutes,
      },
      reasoning: "Conducting multi-factor transparent comparison of all candidate routes.",
    };
  }

  // Step 7: All necessary tools executed; generate final recommendation
  return {
    action: "FINALIZE",
    reasoning: "All operational checks completed. Generating final response and actionable route recommendation.",
  };
}

/**
 * Optional External LLM Function Calling Provider (OpenAI/Gemini-compatible)
 */
async function callExternalLlmPlanner({ state, availableTools, apiKey, provider }) {
  const endpoint = process.env.LLM_ENDPOINT || "https://api.openai.com/v1/chat/completions";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  const toolsPayload = availableTools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

  const messages = [
    {
      role: "system",
      content:
        "You are the RESQ Autonomous Disaster Response Agent for Northeast India. " +
        "Your task is to analyze disaster transit requests, call appropriate registered tools to calculate routes, " +
        "query PostGIS risk zones, check corridor safety, find alternative routes if unsafe, and compare routes. " +
        "Only call registered tools. Do not invent safety results.",
    },
    {
      role: "user",
      content: `Request: "${state.userRequest}". Origin: ${state.origin}, Destination: ${state.destination}, Hazard Type: ${state.disasterType}.`,
    },
  ];

  // Append history of tool calls
  for (const tc of state.toolCalls) {
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: tc.callId,
          type: "function",
          function: { name: tc.tool, arguments: JSON.stringify(tc.inputs) },
        },
      ],
    });
    messages.push({
      role: "tool",
      tool_call_id: tc.callId,
      content: JSON.stringify(tc.data || { error: tc.error }),
    });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: toolsPayload,
      tool_choice: "auto",
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM provider returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0]?.message;

  if (choice?.tool_calls && choice.tool_calls.length > 0) {
    const call = choice.tool_calls[0];
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(call.function.arguments);
    } catch {
      parsedArgs = {};
    }
    return {
      action: "CALL_TOOL",
      tool: call.function.name,
      inputs: parsedArgs,
      reasoning: "LLM selected registered tool based on current observation.",
    };
  }

  return {
    action: "FINALIZE",
    reasoning: choice?.content || "Final response formulated by LLM.",
  };
}
