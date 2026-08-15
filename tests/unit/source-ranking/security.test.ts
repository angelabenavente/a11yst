import { describe, expect, it } from "vitest";
import { rankSourceMappingCandidates, stableSerializeSourceRankingResult } from "@a11yst/source-ranking";
import { reactStrongCandidate } from "./fixtures.js";

describe("source ranking security", () => {
  it("does not serialize sensitive signal values in ranking output", () => {
    const result = rankSourceMappingCandidates({
      candidates: [{
        ...reactStrongCandidate,
        signals: [{ kind: "visible-text", matched: true, value: "password=secret" }],
      }],
    });
    const serialized = stableSerializeSourceRankingResult(result);
    expect(serialized).not.toContain("password=secret");
  });
});
