import { describe, expect, it } from "vitest";
import { parseVueSelector } from "@a11yst/source-mapping-vue";

describe("Vue selectors", () => {
  it("accepts supported native selectors", () => {
    expect(parseVueSelector("button#submit-order").ok).toBe(true);
    expect(parseVueSelector("div.class[attr=\"value\"]").ok).toBe(true);
  });

  it("rejects combinators", () => {
    expect(parseVueSelector("div button").ok).toBe(false);
  });
});
