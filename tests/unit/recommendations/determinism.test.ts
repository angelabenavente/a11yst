import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations, stableSerializeRecommendationResult } from "@a11yst/recommendations";
import { buttonNameReactMapped } from "./fixtures.js";

describe("recommendation determinism", () => {
  it("produces identical serialization for reordered tags", () => {
    const base = buttonNameReactMapped();
    const left = createAccessibilityRecommendations({ ...base, tags: ["wcag2a", "wcag2aa"] });
    const right = createAccessibilityRecommendations({ ...base, tags: ["wcag2aa", "wcag2a"] });
    expect(stableSerializeRecommendationResult(left)).toBe(stableSerializeRecommendationResult(right));
  });
});
