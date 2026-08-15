import { describe, expect, it } from "vitest";
import { resolveRecommendationTarget } from "@a11yst/recommendations";
import { headingOrderAmbiguous, rankingMappingConflict } from "./fixtures.js";

describe("recommendation target", () => {
  it("resolves ranking and mapping to the same location", () => {
    const uri = "apps/storefront/src/components/CheckoutButton.tsx";
    const result = resolveRecommendationTarget({
      sourceMapping: {
        status: "mapped",
        selected: {
          location: { uri, region: { start: { line: 18, column: 1 } } },
          confidence: "high",
          provenance: "selector-match",
          signals: [],
        },
        candidates: [],
        diagnostics: [],
      },
      sourceRanking: {
        version: 1,
        status: "resolved",
        selected: {
          location: { uri, region: { start: { line: 18, column: 1 } } },
          representative: {
            location: { uri, region: { start: { line: 18, column: 1 } } },
            confidence: "high",
            provenance: "selector-match",
            signals: [],
          },
          supportingCandidates: [],
          score: 400,
          effectiveConfidence: "medium",
          contributions: [],
        },
        ranked: [],
        diagnostics: [],
        decision: { minimumResolutionScore: 340, minimumWinningMargin: 60 },
      },
    });
    expect(result.target.status).toBe("source");
    expect(result.target.sourceConfidence).toBe("medium");
  });

  it("returns ambiguous on ranking/mapping conflict", () => {
    const result = resolveRecommendationTarget(rankingMappingConflict());
    expect(result.target.status).toBe("ambiguous");
    expect(result.target.location).toBeUndefined();
    expect(result.diagnostics.some((entry) => entry.code === "recommendation-target-conflict")).toBe(true);
  });

  it("returns ambiguous alternatives without selecting one", () => {
    const result = resolveRecommendationTarget(headingOrderAmbiguous());
    expect(result.target.status).toBe("ambiguous");
    expect(result.target.location).toBeUndefined();
    expect((result.target.alternatives?.length ?? 0)).toBeGreaterThan(1);
  });
});
