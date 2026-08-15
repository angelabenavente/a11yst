import { describe, expect, it } from "vitest";
import {
  createSourceMappingResult,
  stableSerializeSourceMappingResult,
} from "@a11yst/source-mapping";
import {
  buildAngularCandidate,
  buildConflictingExactCandidateA,
  buildConflictingExactCandidateB,
  buildFlowCheckpointCandidate,
  buildNextJsCandidate,
  buildReactComponentCandidate,
  buildVueCandidate,
} from "./fixtures.js";

describe("source mapping determinism", () => {
  const mixedCandidates = [
    buildVueCandidate(),
    buildReactComponentCandidate(),
    buildNextJsCandidate(),
    buildAngularCandidate(),
    buildFlowCheckpointCandidate(),
  ];

  it("produces identical deep results regardless of input order", () => {
    const forward = createSourceMappingResult(mixedCandidates);
    const reverse = createSourceMappingResult([...mixedCandidates].reverse());
    const shuffled = createSourceMappingResult([
      mixedCandidates[2]!,
      mixedCandidates[0]!,
      mixedCandidates[4]!,
      mixedCandidates[1]!,
      mixedCandidates[3]!,
    ]);

    expect(forward).toEqual(reverse);
    expect(forward).toEqual(shuffled);
  });

  it("produces identical serialization", () => {
    const first = stableSerializeSourceMappingResult(
      createSourceMappingResult(mixedCandidates),
    );
    const second = stableSerializeSourceMappingResult(
      createSourceMappingResult([...mixedCandidates].reverse()),
    );
    expect(first).toBe(second);
  });

  it("does not mutate original candidate arrays", () => {
    const input = [...mixedCandidates];
    const copy = structuredClone(input);
    createSourceMappingResult(input);
    expect(input).toEqual(copy);
  });

  it("handles inverted diagnostics deterministically", () => {
    const diagnostics = [
      { code: "ambiguous-candidates" as const, level: "info" as const, message: "info" },
      { code: "duplicate-candidate" as const, level: "warning" as const, message: "warn" },
    ];
    const first = createSourceMappingResult([], diagnostics);
    const second = createSourceMappingResult([], [...diagnostics].reverse());
    expect(first.diagnostics).toEqual(second.diagnostics);
  });

  it("conflicting exact candidates never pick a selected winner", () => {
    const result = createSourceMappingResult([
      buildConflictingExactCandidateA(),
      buildConflictingExactCandidateB(),
    ]);
    expect(result.selected).toBeUndefined();
    expect(result.status).toBe("ambiguous");
  });
});
