import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations } from "@a11yst/recommendations";
import { buttonNameHtmlMapped, buttonNameNextRanked, buttonNameReactMapped, linkNameVue } from "./fixtures.js";

describe("button-name and link-name", () => {
  it("recommends for HTML mapped target", () => {
    const result = createAccessibilityRecommendations(buttonNameHtmlMapped());
    expect(result.status).toBe("recommended");
    expect(result.recommendations[0]?.actions.some((action) => action.id === "button-name.prefer-visible-text")).toBe(true);
  });

  it("includes framework-specific generic examples", () => {
    const react = createAccessibilityRecommendations(buttonNameReactMapped());
    const next = createAccessibilityRecommendations(buttonNameNextRanked());
    const vue = createAccessibilityRecommendations(linkNameVue());
    expect(react.recommendations[0]?.examples[0]?.generic).toBe(true);
    expect(next.recommendations[0]?.examples[0]?.language).toBe("tsx");
    expect(vue.recommendations[0]?.examples[0]?.language).toBe("vue");
  });

  it("does not claim guaranteed remediation", () => {
    const result = createAccessibilityRecommendations(buttonNameReactMapped());
    const text = JSON.stringify(result);
    expect(text).not.toContain("fixes WCAG");
    expect(text).not.toContain("guarantees conformance");
  });
});
