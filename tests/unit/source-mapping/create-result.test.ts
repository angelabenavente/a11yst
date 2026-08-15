import { describe, expect, it } from "vitest";
import {
  createSourceMappingCandidate,
  createSourceMappingResult,
  SourceMappingValidationError,
} from "@a11yst/source-mapping";
import {
  buildConflictingExactCandidateA,
  buildConflictingExactCandidateB,
  buildDuplicateCandidate,
  buildNextJsCandidate,
  buildReactComponentCandidate,
  buildVueCandidate,
} from "./fixtures.js";

describe("createSourceMappingResult", () => {
  it("returns unmapped for zero candidates", () => {
    const result = createSourceMappingResult([]);
    expect(result.status).toBe("unmapped");
    expect(result.selected).toBeUndefined();
    expect(result.candidates).toEqual([]);
  });

  it("returns mapped for one candidate", () => {
    const candidate = buildReactComponentCandidate();
    const result = createSourceMappingResult([candidate]);
    expect(result.status).toBe("mapped");
    expect(result.selected).toEqual(candidate);
    expect(result.candidates).toEqual([candidate]);
  });

  it("deduplicates identical duplicates and can remain mapped", () => {
    const first = buildReactComponentCandidate();
    const second = buildDuplicateCandidate();
    const result = createSourceMappingResult([first, second]);
    expect(result.status).toBe("mapped");
    expect(result.candidates).toHaveLength(1);
    expect(result.diagnostics.some((d) => d.code === "duplicate-candidate")).toBe(true);
  });

  it("selects a single exact candidate among non-exact peers", () => {
    const exact = buildNextJsCandidate();
    const high = buildReactComponentCandidate();
    const result = createSourceMappingResult([high, exact]);
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("exact");
  });

  it("returns ambiguous for two distinct exact candidates", () => {
    const result = createSourceMappingResult([
      buildConflictingExactCandidateA(),
      buildConflictingExactCandidateB(),
    ]);
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "conflicting-exact-candidates")).toBe(
      true,
    );
  });

  it("returns ambiguous for two distinct high candidates", () => {
    const first = buildReactComponentCandidate();
    const second = buildVueCandidate();
    const result = createSourceMappingResult([first, second]);
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "ambiguous-candidates")).toBe(true);
  });

  it("does not auto-select high over medium", () => {
    const high = buildReactComponentCandidate();
    const medium = buildVueCandidate();
    const result = createSourceMappingResult([high, medium]);
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });

  it("returns invalid for invalid candidates", () => {
    expect(() =>
      createSourceMappingCandidate({
        uri: "src/a.ts",
        region: { start: { line: 1 } },
        confidence: "exact",
        provenance: "selector-match",
        signals: [],
      }),
    ).toThrow(SourceMappingValidationError);

    const result = createSourceMappingResult([
      {
        location: {
          uri: "/etc/passwd",
          region: { start: { line: 1 } },
        },
        confidence: "high",
        provenance: "text-match",
        signals: [],
      },
    ]);
    expect(result.status).toBe("invalid");
    expect(result.candidates).toEqual([]);
  });

  it("keeps selected coherent with candidates", () => {
    const candidate = buildNextJsCandidate();
    const result = createSourceMappingResult([candidate]);
    expect(result.selected).toEqual(result.candidates[0]);
  });

  it("sorts candidates deterministically", () => {
    const high = buildReactComponentCandidate();
    const medium = buildVueCandidate({ confidence: "medium" });
    const result = createSourceMappingResult([medium, high]);
    expect(result.candidates[0]?.confidence).toBe("high");
    expect(result.candidates[1]?.confidence).toBe("medium");
  });

  it("sorts diagnostics deterministically", () => {
    const result = createSourceMappingResult([], [
      { code: "ambiguous-candidates", level: "info", message: "b" },
      { code: "duplicate-candidate", level: "warning", message: "a" },
      { code: "invalid-source-uri", level: "error", message: "c" },
    ]);
    expect(result.diagnostics.map((d) => d.level)).toEqual(["error", "warning", "info"]);
  });
});
