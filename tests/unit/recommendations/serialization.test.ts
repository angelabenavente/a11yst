import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations, stableSerializeRecommendationResult } from "@a11yst/recommendations";
import { buttonNameReactMapped } from "./fixtures.js";

describe("recommendation serialization", () => {
  it("produces valid stable JSON", () => {
    const result = createAccessibilityRecommendations(buttonNameReactMapped());
    const serialized = stableSerializeRecommendationResult(result);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(serialized).not.toContain("undefined");
  });
});
