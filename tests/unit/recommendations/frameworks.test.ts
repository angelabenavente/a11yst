import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations, exampleLanguageForFramework, normalizeFramework } from "@a11yst/recommendations";
import { buttonNameHtmlMapped, buttonNameReactMapped } from "./fixtures.js";

describe("framework contextualization", () => {
  it("normalizes framework aliases", () => {
    expect(normalizeFramework("vanilla")).toBe("html");
    expect(normalizeFramework("nextjs")).toBe("next");
    expect(normalizeFramework("unknown-framework")).toBe("unknown");
  });

  it("selects example language by framework", () => {
    expect(exampleLanguageForFramework("react")).toBe("jsx");
    expect(exampleLanguageForFramework("next")).toBe("tsx");
    expect(exampleLanguageForFramework("unknown")).toBe("text");
  });

  it("does not increase applicability from framework alone", () => {
    const html = createAccessibilityRecommendations(buttonNameHtmlMapped());
    const react = createAccessibilityRecommendations(buttonNameReactMapped());
    expect(html.recommendations[0]?.applicability).toBe(react.recommendations[0]?.applicability);
  });
});
