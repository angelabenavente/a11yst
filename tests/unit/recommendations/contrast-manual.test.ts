import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations } from "@a11yst/recommendations";
import { colorContrastUnmapped } from "./fixtures.js";

describe("contrast manual recommendations", () => {
  it("returns manual review for color-contrast", () => {
    const result = createAccessibilityRecommendations(colorContrastUnmapped());
    expect(result.status).toBe("manual-review");
    expect(result.recommendations[0]?.applicability).toBe("medium");
  });

  it("does not invent colors", () => {
    const serialized = JSON.stringify(createAccessibilityRecommendations(colorContrastUnmapped()));
    expect(serialized).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
