import { describe, expect, it } from "vitest";
import { createReactSourceCatalog } from "@a11yst/source-mapping-react";
import { fixtureCatalog, fixtureSourceIndex, FIXTURE_ROOT } from "./helpers.js";

describe("React source catalog", () => {
  it("processes jsx, tsx, and javascript with jsx from the source index", async () => {
    const catalog = await fixtureCatalog();
    expect(catalog.files.some((file) => file.uri.endsWith(".tsx"))).toBe(true);
    expect(catalog.files.some((file) => file.uri.endsWith(".jsx"))).toBe(true);
    expect(catalog.files.some((file) => file.uri.endsWith(".js"))).toBe(true);
    expect(catalog.summary.inputFiles).toBe(10);
  });

  it("does not process html, typescript, vue, or other kinds", async () => {
    const index = fixtureSourceIndex();
    index.files = [...index.files, ...fixtureSourceIndex().files];
    const catalog = await createReactSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: {
        ...index,
        files: [
          ...index.files,
          {
            uri: "ignored.html",
            kind: "html",
            extension: ".html",
            sizeBytes: 1,
            scopeIds: ["legacy"],
          },
          {
            uri: "ignored.ts",
            kind: "typescript",
            extension: ".ts",
            sizeBytes: 1,
            scopeIds: ["legacy"],
          },
        ],
      },
    });
    expect(catalog.files.every((file) => !file.uri.endsWith(".html"))).toBe(true);
    expect(catalog.files.every((file) => !file.uri.endsWith(".ts"))).toBe(true);
  });

  it("handles javascript without jsx without failing", async () => {
    const catalog = await fixtureCatalog();
    const noJsx = catalog.files.find((file) => file.uri === "NoJsx.js");
    expect(noJsx?.hasJsx).toBe(false);
    expect(noJsx?.elements).toEqual([]);
    expect(catalog.summary.filesWithoutJsx).toBe(1);
  });

  it("requires an explicit absolute repository root", async () => {
    const result = await createReactSourceCatalog({
      repositoryRoot: "relative/path",
      sourceIndex: fixtureSourceIndex(),
    });
    expect(result.status).toBe("invalid");
  });

  it("does not expose absolute repository root", async () => {
    const catalog = await fixtureCatalog();
    expect(JSON.stringify(catalog).includes(FIXTURE_ROOT)).toBe(false);
  });

  it("rejects invalid catalog options", async () => {
    const catalog = await createReactSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: fixtureSourceIndex(),
      options: { maxFiles: 0 },
    });
    expect(catalog.status).toBe("invalid");
  });

  it("marks partial when file limit is reached deterministically", async () => {
    const first = await fixtureCatalog({ maxFiles: 2 });
    const second = await fixtureCatalog({ maxFiles: 2 });
    expect(first.status).toBe("partial");
    expect(first.summary.parsedFiles).toBe(2);
    expect(first.files).toEqual(second.files);
  });

  it("does not mutate source index input", async () => {
    const index = fixtureSourceIndex();
    const snapshot = structuredClone(index);
    await fixtureCatalog();
    expect(index).toEqual(snapshot);
  });
});
