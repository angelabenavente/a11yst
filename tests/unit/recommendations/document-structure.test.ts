import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations } from "@a11yst/recommendations";

describe("document structure recommendations", () => {
  it("supports html-has-lang and document-title", () => {
    expect(createAccessibilityRecommendations({ ruleId: "html-has-lang" }).recommendations[0]?.applicability).toBe("high");
    expect(createAccessibilityRecommendations({ ruleId: "document-title" }).recommendations[0]?.applicability).toBe("high");
  });

  it("supports heading-order and landmark-one-main", () => {
    expect(createAccessibilityRecommendations({ ruleId: "heading-order" }).status).toBe("manual-review");
    expect(createAccessibilityRecommendations({ ruleId: "landmark-one-main" }).recommendations[0]?.actions.length).toBeGreaterThan(0);
  });

  it("supports duplicate-id-aria", () => {
    const result = createAccessibilityRecommendations({ ruleId: "duplicate-id-aria" });
    expect(result.recommendations[0]?.actions.some((action) => action.id === "duplicate-id-aria.unique")).toBe(true);
  });
});
