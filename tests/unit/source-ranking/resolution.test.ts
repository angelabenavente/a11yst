import { describe, expect, it } from "vitest";
import { rankSourceMappingCandidates } from "@a11yst/source-ranking";
import { duplicateSelectorA, duplicateSelectorB, lowOnlyCandidate, reactStrongCandidate, reactWeakCandidate } from "./fixtures.js";

describe("source ranking resolution", () => {
  it("resolves a clearly stronger high candidate", () => {
    const result = rankSourceMappingCandidates({
      candidates: [reactStrongCandidate, reactWeakCandidate],
    });
    expect(result.status).toBe("resolved");
    expect(result.selected?.location.uri).toContain("CheckoutButton.tsx");
  });

  it("returns ambiguous for duplicate strong selectors", () => {
    const result = rankSourceMappingCandidates({
      candidates: [duplicateSelectorA, duplicateSelectorB],
    });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });

  it("returns insufficient for low-only evidence by default", () => {
    const result = rankSourceMappingCandidates({ candidates: [lowOnlyCandidate] });
    expect(result.status).toBe("insufficient");
  });
});
