import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations } from "@a11yst/recommendations";
import { imageAltNuxt, labelAngularInline, sensitiveInput } from "./fixtures.js";

describe("images and labels", () => {
  it("requires manual review for image-alt", () => {
    const result = createAccessibilityRecommendations(imageAltNuxt());
    expect(result.status).toBe("manual-review");
    expect(result.recommendations[0]?.examples.every((example) => example.generic)).toBe(true);
  });

  it("uses generic examples without product-specific text", () => {
    const result = createAccessibilityRecommendations(imageAltNuxt());
    const exampleText = result.recommendations[0]?.examples.map((example) => example.code).join("\n") ?? "";
    expect(exampleText).not.toContain("CheckoutButton");
    expect(exampleText).not.toContain("product-image-real-url");
  });

  it("supports label guidance for Angular inline", () => {
    const result = createAccessibilityRecommendations(labelAngularInline());
    expect(result.recommendations[0]?.actions.some((action) => action.id === "label.visible-label")).toBe(true);
  });

  it("redacts sensitive attribute values", () => {
    const result = createAccessibilityRecommendations(sensitiveInput());
    expect(JSON.stringify(result)).not.toContain("Password123!");
  });
});
