import { describe, expect, it } from "vitest";
import { fixtureCatalog, findElement } from "./helpers.js";

describe("HTML source locations", () => {
  it("uses start tag line and column for indexed elements", async () => {
    const catalog = await fixtureCatalog();
    const submit = findElement(catalog, "legacy-checkout.html", "submit-order");
    expect(submit?.region.start.line).toBeGreaterThan(0);
    expect(submit?.region.start.column).toBeGreaterThan(0);
    expect(submit?.region.end).toBeDefined();
  });

  it("indexes nested and void-like elements with valid regions", async () => {
    const catalog = await fixtureCatalog();
    const logo = findElement(catalog, "legacy-checkout.html");
    const img = catalog.files
      .find((file) => file.uri === "legacy-checkout.html")
      ?.elements.find((element) => element.tagName === "img");
    expect(logo).toBeDefined();
    expect(img?.attributes.alt).toBe("Store logo");
  });

  it("still indexes recoverable malformed HTML with locations", async () => {
    const catalog = await fixtureCatalog();
    const file = catalog.files.find((entry) => entry.uri === "malformed.html");
    expect(file?.elements.length).toBeGreaterThan(0);
    expect(catalog.diagnostics.some((d) => d.code === "html-parse-warning")).toBe(true);
  });
});
