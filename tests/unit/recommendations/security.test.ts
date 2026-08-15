import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations, stableSerializeRecommendationResult } from "@a11yst/recommendations";
import { buttonNameReactMapped, hostileHelpUrl, sensitiveInput } from "./fixtures.js";

describe("recommendation security", () => {
  it("does not serialize secrets or absolute paths", () => {
    const result = createAccessibilityRecommendations({
      ...buttonNameReactMapped(),
      message: "Bearer secret-token",
    });
    const serialized = stableSerializeRecommendationResult(result);
    expect(serialized).not.toContain("Bearer secret-token");
    expect(serialized).not.toContain("/Users/");
  });

  it("redacts sensitive diagnostics safely", () => {
    const result = createAccessibilityRecommendations(sensitiveInput());
    expect(result.diagnostics.some((entry) => entry.code === "recommendation-sensitive-value-redacted")).toBe(true);
  });

  it("rejects javascript help URLs without network access", () => {
    expect(createAccessibilityRecommendations(hostileHelpUrl()).recommendations[0]?.documentationUrl).toBeUndefined();
  });
});
