import { describe, expect, it } from "vitest";
import { createAccessibilityRecommendations } from "@a11yst/recommendations";
import { hostileHelpUrl } from "./fixtures.js";

describe("recommendation fallback", () => {
  it("returns unsupported for unknown rules", () => {
    const result = createAccessibilityRecommendations({ ruleId: "totally-unknown-rule" });
    expect(result.status).toBe("unsupported");
    expect(result.recommendations[0]?.actions.length).toBeGreaterThan(0);
  });

  it("rejects hostile help URLs", () => {
    const result = createAccessibilityRecommendations(hostileHelpUrl());
    expect(result.diagnostics.some((entry) => entry.code === "invalid-help-url")).toBe(true);
  });
});
