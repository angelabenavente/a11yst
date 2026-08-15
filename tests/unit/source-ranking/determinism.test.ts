import { describe, expect, it } from "vitest";
import { rankSourceMappingCandidates, stableSerializeSourceRankingResult } from "@a11yst/source-ranking";
import { reactStrongCandidate, reactWeakCandidate } from "./fixtures.js";

describe("source ranking determinism", () => {
  it("produces byte-identical serialization for reordered candidates", () => {
    const left = rankSourceMappingCandidates({ candidates: [reactStrongCandidate, reactWeakCandidate] });
    const right = rankSourceMappingCandidates({ candidates: [reactWeakCandidate, reactStrongCandidate] });
    expect(stableSerializeSourceRankingResult(left)).toBe(stableSerializeSourceRankingResult(right));
  });
});
