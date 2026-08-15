import { describe, expect, it } from "vitest";
import { createHtmlSourceCatalog, mapHtmlSource, stableSerializeHtmlCatalog } from "@a11yst/source-mapping-html";
import { fixtureCatalog, FIXTURE_ROOT, fixtureSourceIndex } from "./helpers.js";

describe("HTML mapping security", () => {
  it("does not store script content, secrets, or absolute paths", async () => {
    const catalog = await fixtureCatalog();
    const result = mapHtmlSource({
      catalog,
      evidence: { selector: "#secret-password" },
    });
    const serialized = JSON.stringify({ catalog, result });
    expect(serialized.includes(FIXTURE_ROOT)).toBe(false);
    expect(serialized.includes("SuperSecret123")).toBe(false);
    expect(serialized.includes("must-not-index")).toBe(false);
    expect(serialized.includes("javascript:alert")).toBe(false);
    expect(serialized.includes("Bearer token")).toBe(false);
  });

  it("redacts sensitive catalog content from sensitive fixture", async () => {
    const catalog = await fixtureCatalog();
    const serialized = JSON.stringify(catalog);
    expect(serialized.includes("SuperSecret")).toBe(false);
    expect(serialized.includes("password=")).toBe(false);
  });
});

describe("HTML mapping determinism", () => {
  it("returns identical catalogs and mappings for reordered index files", async () => {
    const index = fixtureSourceIndex();
    const reversed = {
      ...index,
      files: [...index.files].reverse(),
    };
    const first = await createHtmlSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: index,
    });
    const second = await createHtmlSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: reversed,
    });
    expect(stableSerializeHtmlCatalog(first)).toBe(stableSerializeHtmlCatalog(second));

    const evidence = { selector: "#submit-order" };
    expect(mapHtmlSource({ catalog: first, evidence })).toEqual(
      mapHtmlSource({ catalog: second, evidence }),
    );
  });
});

describe("HTML mapping read boundaries", () => {
  it("reads html files but not other indexed kinds", async () => {
    const readLog: string[] = [];
    const filesystem = {
      realpath: async () => FIXTURE_ROOT,
      lstat: async () => ({ isFile: () => true, isSymbolicLink: () => false }),
      readFile: async (target: string) => {
        readLog.push(target);
        const { readFile } = await import("node:fs/promises");
        return readFile(target, "utf8");
      },
    };

    await createHtmlSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: fixtureSourceIndex(),
      filesystem,
    });

    expect(readLog.every((path) => path.endsWith(".html"))).toBe(true);
    expect(readLog.some((path) => path.endsWith(".tsx"))).toBe(false);
  });
});
