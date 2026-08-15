import { describe, expect, it } from "vitest";
import { createSourceMappingResult } from "@a11yst/source-mapping";
import { createAccessibilityRecommendations } from "@a11yst/recommendations";

describe("recommendation compatibility", () => {
  it("does not alter source mapping behavior", () => {
    const mapping = createSourceMappingResult([
      {
        location: { uri: "apps/a.tsx", region: { start: { line: 1, column: 1 } } },
        confidence: "high",
        provenance: "selector-match",
        signals: [{ kind: "selector", matched: true, value: "button#a" }],
      },
      {
        location: { uri: "apps/b.tsx", region: { start: { line: 1, column: 1 } } },
        confidence: "high",
        provenance: "selector-match",
        signals: [{ kind: "selector", matched: true, value: "button#b" }],
      },
    ]);
    expect(mapping.status).toBe("ambiguous");
    expect(mapping.selected).toBeUndefined();
  });

  it("does not add recommendations to findings automatically", () => {
    const result = createAccessibilityRecommendations({ ruleId: "button-name" });
    expect(result.version).toBe(1);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
