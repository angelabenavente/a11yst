import { describe, expect, it } from "vitest";
import { createHtmlSourceCatalog } from "@a11yst/source-mapping-html";
import { fixtureCatalog, fixtureSourceIndex, FIXTURE_ROOT } from "./helpers.js";

describe("HTML source catalog", () => {
  it("processes only html kind files from the source index", async () => {
    const catalog = await fixtureCatalog();
    expect(catalog.files.every((file) => file.uri.endsWith(".html"))).toBe(true);
    expect(catalog.files.some((file) => file.uri.includes(".tsx"))).toBe(false);
    expect(catalog.summary.inputFiles).toBe(5);
    expect(catalog.summary.parsedFiles).toBe(5);
  });

  it("does not traverse the repository independently", async () => {
    const index = fixtureSourceIndex();
    index.files = index.files.filter((file) => file.uri === "legacy-checkout.html");
    const catalog = await createHtmlSourceCatalog({
      repositoryRoot: FIXTURE_ROOT,
      sourceIndex: index,
    });
    expect(catalog.files).toHaveLength(1);
  });

  it("requires an explicit absolute repository root", async () => {
    const result = await createHtmlSourceCatalog({
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
    const catalog = await createHtmlSourceCatalog({
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
});
