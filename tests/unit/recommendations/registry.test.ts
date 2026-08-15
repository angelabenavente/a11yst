import { describe, expect, it } from "vitest";
import { getRecommendationRegistry, listRecipeRuleIds, lookupRecipe } from "@a11yst/recommendations";

describe("recommendation registry", () => {
  it("lists unique stable rule IDs", () => {
    const ids = listRecipeRuleIds();
    expect(ids).toContain("button-name");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("looks up recipes by rule ID", () => {
    expect(lookupRecipe("button-name")?.title).toContain("button");
    expect(lookupRecipe("unknown-rule")).toBeUndefined();
  });

  it("returns the same registry instance", () => {
    const left = getRecommendationRegistry();
    const right = getRecommendationRegistry();
    expect(left).toBe(right);
  });
});
