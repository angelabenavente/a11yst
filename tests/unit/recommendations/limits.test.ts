import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations } from "@a11yst/recommendations";
import { buttonNameReactMapped } from "./fixtures.js";

describe("recommendation limits", () => {
  it("rejects invalid rule IDs", () => {
    expect(createAccessibilityRecommendations({ ruleId: "bad rule!" }).status).toBe("invalid");
  });

  it("truncates long tag lists deterministically", () => {
    const tags = Array.from({ length: 100 }, (_, index) => `tag-${index}`);
    const result = createAccessibilityRecommendations({ ...buttonNameReactMapped(), tags });
    expect(result.diagnostics.some((entry) => entry.code === "recommendation-input-truncated")).toBe(true);
  });
});
