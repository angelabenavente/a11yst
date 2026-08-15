import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations } from "@a11yst/recommendations";

describe("ARIA recommendations", () => {
  it("supports aria-dialog-name", () => {
    const result = createAccessibilityRecommendations({
      ruleId: "aria-dialog-name",
      element: { role: "dialog" },
      sourceMapping: {
        status: "mapped",
        selected: {
          location: { uri: "apps/a/Dialog.tsx", region: { start: { line: 5, column: 1 } } },
          confidence: "high",
          provenance: "component-match",
          signals: [],
        },
        candidates: [],
        diagnostics: [],
      },
    });
    expect(result.status).toBe("manual-review");
    expect(result.recommendations[0]?.verification.some((step) => step.mode === "keyboard")).toBe(true);
  });

  it("supports aria-valid-attr-value and aria-required-attr", () => {
    for (const ruleId of ["aria-valid-attr-value", "aria-required-attr", "aria-input-field-name"]) {
      const result = createAccessibilityRecommendations({ ruleId });
      expect(result.recommendations[0]?.ruleId).toBe(ruleId);
      expect(result.recommendations[0]?.caveats.some((c) => c.includes("WCAG"))).toBe(true);
    }
  });
});
