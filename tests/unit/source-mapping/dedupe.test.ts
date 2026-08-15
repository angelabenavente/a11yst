import { describe, expect, it } from "vitest";
import { dedupeCandidates, createSourceMappingCandidate } from "@a11yst/source-mapping";
import { buildDuplicateCandidate, buildReactComponentCandidate } from "./fixtures.js";

describe("dedupeCandidates", () => {
  it("merges identical duplicates into one result", () => {
    const first = buildReactComponentCandidate();
    const second = buildDuplicateCandidate();
    const { candidates, duplicateDetected } = dedupeCandidates([first, second]);
    expect(duplicateDetected).toBe(true);
    expect(candidates).toHaveLength(1);
  });

  it("merges signals from duplicates", () => {
    const first = buildReactComponentCandidate();
    const second = buildDuplicateCandidate();
    const { candidates } = dedupeCandidates([first, second]);
    expect(candidates[0]?.signals.some((s) => s.kind === "component-name")).toBe(true);
    expect(candidates[0]?.signals.some((s) => s.kind === "attribute")).toBe(true);
  });

  it("orders merged signals deterministically", () => {
    const first = buildReactComponentCandidate();
    const second = buildDuplicateCandidate();
    const firstPass = dedupeCandidates([first, second]).candidates[0]?.signals ?? [];
    const secondPass = dedupeCandidates([second, first]).candidates[0]?.signals ?? [];
    expect(firstPass).toEqual(secondPass);
  });

  it("keeps distinct provenance separate", () => {
    const component = buildReactComponentCandidate();
    const selector = createSourceMappingCandidate({
      uri: "apps/storefront/src/components/CheckoutButton.tsx",
      region: { start: { line: 42, column: 3 } },
      confidence: "high",
      provenance: "selector-match",
      signals: [{ kind: "selector", matched: true, value: "button.checkout" }],
    });
    const { candidates, duplicateDetected } = dedupeCandidates([component, selector]);
    expect(duplicateDetected).toBe(false);
    expect(candidates).toHaveLength(2);
  });

  it("does not mutate input arrays", () => {
    const first = buildReactComponentCandidate();
    const second = buildDuplicateCandidate();
    const input = [first, second];
    const copy = structuredClone(input);
    dedupeCandidates(input);
    expect(input).toEqual(copy);
  });

  it("is deterministic", () => {
    const first = buildReactComponentCandidate();
    const second = buildDuplicateCandidate();
    const third = createSourceMappingCandidate({
      uri: "apps/storefront/src/components/CheckoutButton.tsx",
      region: { start: { line: 42, column: 3 } },
      confidence: "medium",
      provenance: "component-match",
      signals: [{ kind: "attribute", matched: true, value: "aria-label" }],
    });
    const once = dedupeCandidates([first, second, third]);
    const twice = dedupeCandidates([third, first, second]);
    expect(once).toEqual(twice);
  });
});
