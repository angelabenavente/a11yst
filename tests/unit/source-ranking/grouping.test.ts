import { describe, expect, it } from "vitest";
import { groupCandidatesByMaterialLocation, selectRepresentative } from "@a11yst/source-ranking";
import { duplicateSelectorA, sameLocationComponent, sameLocationSelector } from "./fixtures.js";

describe("source ranking grouping", () => {
  it("groups candidates by material location regardless of provenance", () => {
    const groups = groupCandidatesByMaterialLocation([sameLocationSelector, sameLocationComponent]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.candidates).toHaveLength(2);
  });

  it("separates different lines and columns", () => {
    const groups = groupCandidatesByMaterialLocation([duplicateSelectorA, sameLocationSelector]);
    expect(groups).toHaveLength(2);
  });

  it("selects representative deterministically", () => {
    const { representative, supportingCandidates } = selectRepresentative([
      sameLocationComponent,
      sameLocationSelector,
    ]);
    expect(representative.provenance).toBe("selector-match");
    expect(supportingCandidates).toHaveLength(1);
  });

  it("does not mutate input candidates", () => {
    const input = [duplicateSelectorA, sameLocationSelector];
    const before = structuredClone(input);
    groupCandidatesByMaterialLocation(input);
    expect(input).toEqual(before);
  });
});
