import { describe, expect, it } from "vitest";
import { mapVueSource, stableSerializeVueCatalog } from "@a11yst/source-mapping-vue";
import { fixtureCatalog, fixtureSourceIndex } from "./helpers.js";

describe("Vue ambiguity", () => {
  it("does not select when duplicate cancel buttons share text", async () => {
    const catalog = await fixtureCatalog();
    const result = mapVueSource({
      catalog,
      evidence: { tagName: "button", visibleText: "Cancel" },
    });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });
});

describe("Vue security", () => {
  it("does not serialize source code or secrets in catalog output", async () => {
    const catalog = await fixtureCatalog();
    const serialized = stableSerializeVueCatalog(catalog);
    expect(serialized).not.toContain("Password123!");
    expect(serialized).not.toContain("<script setup");
    expect(serialized).not.toContain("Bearer secret-token");
  });
});

describe("Vue determinism", () => {
  it("produces identical catalogs for reordered source index files", async () => {
    const index = fixtureSourceIndex();
    const reversed = { ...index, files: [...index.files].reverse() };
    const left = await fixtureCatalog();
    const right = await createCatalogFromIndex(reversed);
    expect(stableSerializeVueCatalog(left)).toBe(stableSerializeVueCatalog(right));
  });
});

async function createCatalogFromIndex(sourceIndex: ReturnType<typeof fixtureSourceIndex>) {
  const { createVueSourceCatalog } = await import("@a11yst/source-mapping-vue");
  const { FIXTURE_ROOT } = await import("./helpers.js");
  return createVueSourceCatalog({ repositoryRoot: FIXTURE_ROOT, sourceIndex });
}

describe("Vue compatibility", () => {
  it("does not change shared source mapping contracts", async () => {
    const catalog = await fixtureCatalog();
    expect(catalog.version).toBe(1);
  });
});
