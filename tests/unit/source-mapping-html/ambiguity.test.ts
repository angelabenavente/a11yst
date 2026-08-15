import { describe, expect, it } from "vitest";
import { mapHtmlSource } from "@a11yst/source-mapping-html";
import { fixtureCatalog } from "./helpers.js";

describe("HTML mapping ambiguity", () => {
  it("does not select the first of multiple high-confidence candidates", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { selector: ".primary.action" },
    });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });

  it("keeps deterministic candidate ordering via source mapping", async () => {
    const catalog = await fixtureCatalog();
    const forward = mapHtmlSource({ catalog, evidence: { selector: "#dup-id" } });
    const reverse = mapHtmlSource({ catalog, evidence: { selector: "#dup-id" } });
    expect(forward).toEqual(reverse);
  });
});

describe("existing source location priority", () => {
  it("returns mapped exact immediately for valid existing locations", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: {
        selector: "#submit-order",
        existingSourceLocation: {
          uri: "legacy-checkout.html",
          startLine: 20,
          startColumn: 5,
        },
      },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("exact");
    expect(result.selected?.provenance).toBe("existing-source-location");
    expect(result.candidates).toHaveLength(1);
  });
});
