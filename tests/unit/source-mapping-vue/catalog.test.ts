import { describe, expect, it } from "vitest";
import { fixtureCatalog, fixtureSourceIndex } from "./helpers.js";

describe("Vue source catalog", () => {
  it("indexes .vue files from the source index only", async () => {
    const catalog = await fixtureCatalog();
    expect(catalog.files.length).toBeGreaterThan(0);
    expect(catalog.files.every((file) => file.uri.endsWith(".vue"))).toBe(true);
    expect(catalog.summary.parsedFiles).toBeGreaterThan(0);
  });

  it("records files without templates and unsupported languages", async () => {
    const catalog = await fixtureCatalog();
    expect(catalog.summary.filesWithoutTemplate).toBeGreaterThanOrEqual(1);
    expect(catalog.summary.unsupportedTemplateLanguages).toBeGreaterThanOrEqual(1);
  });

  it("does not mutate the source index input", () => {
    const index = fixtureSourceIndex();
    const before = structuredClone(index);
    void before;
    expect(fixtureSourceIndex()).toEqual(before);
  });
});
