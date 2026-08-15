import { describe, expect, it } from "vitest";
import { rankSourceMappingCandidates } from "@a11yst/source-ranking";
import { candidate, duplicateSelectorA, duplicateSelectorB, signal } from "./fixtures.js";

describe("source ranking ambiguity", () => {
  it("returns ambiguous for duplicate strong selectors", () => {
    const result = rankSourceMappingCandidates({ candidates: [duplicateSelectorA, duplicateSelectorB] });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });

  it("returns ambiguous when margin is insufficient", () => {
    const left = candidate({ uri: "apps/a.tsx", line: 1, confidence: "high", provenance: "selector-match", signals: [signal("selector", true, "button#a")] });
    const right = candidate({ uri: "apps/b.tsx", line: 1, confidence: "high", provenance: "selector-match", signals: [signal("selector", true, "button#b")] });
    expect(rankSourceMappingCandidates({ candidates: [left, right], options: { minimumWinningMargin: 9999 } }).status).toBe("ambiguous");
  });
});
