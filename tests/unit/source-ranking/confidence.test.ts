import { describe, expect, it } from "vitest";
import { computeGroupScore, rankSourceMappingCandidates } from "@a11yst/source-ranking";
import { candidate, mediumStrongCandidate, reactStrongCandidate, reactWeakCandidate, signal } from "./fixtures.js";

describe("source ranking confidence", () => {
  it("never increases confidence", () => {
    const result = rankSourceMappingCandidates({ candidates: [reactStrongCandidate, reactWeakCandidate] });
    expect(result.selected?.effectiveConfidence).not.toBe("exact");
  });

  it("degrades high confidence when strong signals conflict", () => {
    const scored = computeGroupScore({
      candidates: [candidate({
        uri: "src/a.tsx",
        line: 1,
        confidence: "high",
        provenance: "selector-match",
        signals: [signal("selector", true, "button"), signal("selector", false, "button")],
      })],
      context: {},
      maxSignalsPerCandidate: 64,
    });
    expect(scored.effectiveConfidence).toBe("medium");
  });

  it("resolves medium with multiple strong signals without upgrading confidence", () => {
    const result = rankSourceMappingCandidates({ candidates: [mediumStrongCandidate, reactWeakCandidate] });
    expect(result.status).toBe("resolved");
    expect(result.selected?.effectiveConfidence).toBe("medium");
  });
});
