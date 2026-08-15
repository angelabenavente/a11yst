import { describe, expect, it } from "vitest";
import { stableSerializeVueCatalog } from "@a11yst/source-mapping-vue";
import { fixtureCatalog, fixtureSourceIndex, FIXTURE_ROOT } from "./helpers.js";
import { createVueSourceCatalog } from "@a11yst/source-mapping-vue";

describe("Vue determinism", () => {
  it("matches catalogs built from normal and reversed file order", async () => {
    const index = fixtureSourceIndex();
    const reversed = { ...index, files: [...index.files].reverse() };
    const left = await createVueSourceCatalog({ repositoryRoot: FIXTURE_ROOT, sourceIndex: index });
    const right = await createVueSourceCatalog({ repositoryRoot: FIXTURE_ROOT, sourceIndex: reversed });
    expect(stableSerializeVueCatalog(left)).toBe(stableSerializeVueCatalog(right));
  });
});

describe("Vue compatibility", () => {
  it("exposes catalog version 1", async () => {
    const catalog = await fixtureCatalog();
    expect(catalog.version).toBe(1);
  });
});
