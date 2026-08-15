import { describe, expect, it } from "vitest";
import {
  compareConfidence,
  CONFIDENCE_ORDER,
  createSourceMappingCandidate,
  SourceMappingValidationError,
  validateConfidenceProvenance,
} from "@a11yst/source-mapping";

describe("confidence and provenance validation", () => {
  it("allows exact for supported provenance", () => {
    expect(() => validateConfidenceProvenance("exact", "existing-source-location")).not.toThrow();
    expect(() => validateConfidenceProvenance("exact", "source-map")).not.toThrow();
    expect(() => validateConfidenceProvenance("exact", "framework-compiler")).not.toThrow();
  });

  it("rejects exact for heuristic provenance", () => {
    expect(() => validateConfidenceProvenance("exact", "selector-match")).toThrow(
      SourceMappingValidationError,
    );
    expect(() => validateConfidenceProvenance("exact", "text-match")).toThrow(
      SourceMappingValidationError,
    );
    expect(() => validateConfidenceProvenance("exact", "component-match")).toThrow(
      SourceMappingValidationError,
    );
    expect(() => validateConfidenceProvenance("exact", "user-provided")).toThrow(
      SourceMappingValidationError,
    );
  });

  it("allows non-exact heuristic provenance", () => {
    expect(
      createSourceMappingCandidate({
        uri: "src/a.tsx",
        region: { start: { line: 1 } },
        confidence: "high",
        provenance: "selector-match",
        signals: [],
      }).confidence,
    ).toBe("high");

    expect(
      createSourceMappingCandidate({
        uri: "src/a.tsx",
        region: { start: { line: 1 } },
        confidence: "medium",
        provenance: "text-match",
        signals: [],
      }).confidence,
    ).toBe("medium");
  });

  it("orders confidence deterministically", () => {
    expect(CONFIDENCE_ORDER).toEqual(["exact", "high", "medium", "low"]);
    expect(compareConfidence("exact", "high")).toBeLessThan(0);
    expect(compareConfidence("low", "medium")).toBeGreaterThan(0);
  });
});
