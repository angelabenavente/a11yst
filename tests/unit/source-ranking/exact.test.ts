import { describe, expect, it } from "vitest";
import { rankSourceMappingCandidates } from "@a11yst/source-ranking";
import { exactCandidateA, exactCandidateB, reactWeakCandidate } from "./fixtures.js";

describe("source ranking exact mappings", () => {
  it("resolves one exact over heuristics", () => {
    const result = rankSourceMappingCandidates({ candidates: [reactWeakCandidate, exactCandidateA] });
    expect(result.status).toBe("resolved");
    expect(result.selected?.representative.confidence).toBe("exact");
  });

  it("returns ambiguous for two distinct exact locations", () => {
    const result = rankSourceMappingCandidates({ candidates: [exactCandidateA, exactCandidateB] });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });
});
