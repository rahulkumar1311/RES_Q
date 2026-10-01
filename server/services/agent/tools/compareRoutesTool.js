// Tool 6: compare_routes
// Provides transparent multi-factor comparison across candidate route options using actual service metrics

export const compareRoutesToolDefinition = {
  name: "compare_routes",
  description: "Compares multiple evaluated route candidates across distance, duration, mean disaster risk, and confirmed hazard blockages.",
  inputSchema: {
    type: "object",
    required: ["candidateRoutes"],
    properties: {
      candidateRoutes: {
        type: "array",
        description: "List of route candidate objects to compare",
      },
    },
  },
  validateInputs(inputs = {}) {
    if (!inputs.candidateRoutes || !Array.isArray(inputs.candidateRoutes)) {
      return { valid: false, error: "Parameter 'candidateRoutes' must be an array" };
    }
    return { valid: true };
  },
  async handler(inputs = {}) {
    const candidates = inputs.candidateRoutes || [];

    if (candidates.length === 0) {
      return {
        comparisonCount: 0,
        rankedRoutes: [],
        bestRoute: null,
        message: "No route candidates provided for comparison.",
      };
    }

    if (candidates.length === 1) {
      const single = candidates[0];
      return {
        comparisonCount: 1,
        rankedRoutes: [
          {
            index: 0,
            routeId: single.routeId || "route_1",
            distanceKm: single.distanceKm || 0,
            durationMinutes: single.durationMinutes || 0,
            meanRiskScore: single.riskScore ?? single.riskSnapshot?.meanRisk ?? 0,
            riskStatus: single.riskStatus ?? single.riskSnapshot?.routeStatus ?? "UNKNOWN",
            isBlocked: Boolean(single.isBlocked ?? single.riskSnapshot?.isBlocked),
            blockedSegments: single.riskSnapshot?.blockedSegmentCount || 0,
            rank: 1,
            verdict: single.isBlocked ? "Passes through active blockage (Only corridor available)" : "Direct corridor available",
          },
        ],
        bestRoute: {
          ...single,
          meanRiskScore: single.riskScore ?? single.riskSnapshot?.meanRisk ?? single.meanRiskScore ?? 0,
          riskStatus: single.riskStatus ?? single.riskSnapshot?.routeStatus ?? "SAFE",
          isBlocked: Boolean(single.isBlocked ?? single.riskSnapshot?.isBlocked),
        },
        message: "Only one route candidate available for evaluation.",
      };
    }

    // Normalized comparison
    const minDurationSec = Math.min(...candidates.map((c) => c.durationSeconds || c.durationMinutes * 60 || 1));

    const evaluated = candidates.map((c, index) => {
      const risk = Number(c.riskScore ?? c.riskSnapshot?.meanRisk ?? c.meanRiskScore ?? 0);
      const isBlocked = Boolean(c.isBlocked ?? c.riskSnapshot?.isBlocked);
      const blockedSegments = Number(c.riskSnapshot?.blockedSegmentCount || (isBlocked ? 1 : 0));
      const criticalGrids = Number(c.riskSnapshot?.criticalGridCount || (risk >= 70 ? 1 : 0));
      const durationSec = Number(c.durationSeconds || c.durationMinutes * 60 || 1);
      const distanceKm = Number(c.distanceKm || 0);

      // Objective safety index (0 is best, 100 is worst)
      // Blocked routes penalized by +50 points
      const blockagePenalty = isBlocked ? 50 : 0;
      const criticalPenalty = Math.min(20, criticalGrids * 5);
      const timeRatio = Math.min(2.5, durationSec / Math.max(1, minDurationSec));
      const safetyPenalty = (risk * 0.5) + (timeRatio * 10) + blockagePenalty + criticalPenalty;

      return {
        index,
        routeId: c.routeId || `candidate_${index + 1}`,
        distanceKm: Math.round(distanceKm * 10) / 10,
        durationMinutes: Math.round((durationSec / 60) * 10) / 10,
        meanRiskScore: Math.round(risk * 10) / 10,
        riskStatus: c.riskStatus ?? c.riskSnapshot?.routeStatus ?? "UNKNOWN",
        isBlocked,
        blockedSegments,
        criticalGrids,
        safetyPenalty: Math.round(safetyPenalty * 10) / 10,
        rawRoute: c,
      };
    });

    // Sort by safety penalty ascending (lowest penalty is safest/best)
    evaluated.sort((a, b) => a.safetyPenalty - b.safetyPenalty);

    const rankedRoutes = evaluated.map((item, rankIdx) => {
      let verdict = "";
      if (item.isBlocked) {
        verdict = "UNSAFE: Traverses active road blockage";
      } else if (item.meanRiskScore >= 70) {
        verdict = "HIGH DANGER: Crosses critical flood/landslide zones";
      } else if (rankIdx === 0) {
        verdict = "RECOMMENDED: Safest corridor with lowest disaster exposure";
      } else {
        verdict = "PASSABLE: Higher risk or longer transit than recommended";
      }

      return {
        rank: rankIdx + 1,
        index: item.index,
        routeId: item.routeId,
        distanceKm: item.distanceKm,
        durationMinutes: item.durationMinutes,
        meanRiskScore: item.meanRiskScore,
        riskStatus: item.riskStatus,
        isBlocked: item.isBlocked,
        blockedSegments: item.blockedSegments,
        safetyPenalty: item.safetyPenalty,
        verdict,
      };
    });

    const bestRanked = evaluated[0];
    const bestRoute = {
      ...bestRanked.rawRoute,
      meanRiskScore: bestRanked.meanRiskScore,
      riskStatus: bestRanked.riskStatus,
      isBlocked: bestRanked.isBlocked,
      blockedSegments: bestRanked.blockedSegments,
      verdict: rankedRoutes[0]?.verdict,
    };

    return {
      comparisonCount: candidates.length,
      rankedRoutes,
      bestRouteIndex: bestRanked.index,
      bestRoute,
      recommendationSummary: `Candidate #${bestRanked.index + 1} (${bestRanked.distanceKm} km, ${bestRanked.durationMinutes} min, Risk: ${bestRanked.meanRiskScore}/100) is ranked highest. ${rankedRoutes[0].verdict}.`,
    };
  },
};
