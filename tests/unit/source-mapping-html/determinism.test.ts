import { describe, expect, it } from "vitest";
import { stableSerializeHtmlCatalog } from "@a11yst/source-mapping-html";
import { stableSerializeSourceMappingResult } from "@a11yst/source-mapping";
import { fixtureCatalog } from "./helpers.js";
import { mapHtmlSource } from "@a11yst/source-mapping-html";

describe("HTML mapping determinism serialization", () => {
  it("serializes stable catalog and mapping JSON", async () => {
    const catalog = await fixtureCatalog();
    const mapping = mapHtmlSource({ catalog, evidence: { selector: "#submit-order" } });
    expect(() => JSON.parse(stableSerializeHtmlCatalog(catalog))).not.toThrow();
    expect(() => JSON.parse(stableSerializeSourceMappingResult(mapping))).not.toThrow();
    expect(stableSerializeHtmlCatalog(catalog)).toBe(stableSerializeHtmlCatalog(catalog));
  });
});
