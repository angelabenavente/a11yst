import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("HTML text matching", () => {
  it("excludes script and style text from catalog elements", async () => {
    const catalog = await fixtureCatalog();
    const serialized = JSON.stringify(catalog);
    expect(serialized.includes("must-not-index")).toBe(false);
    expect(serialized.includes("color: red")).toBe(false);
  });

  it("preserves unicode static text in catalog hints", async () => {
    const catalog = await fixtureCatalog();
    const heading = catalog.files
      .find((file) => file.uri === "legacy-checkout.html")
      ?.elements.find((element) => element.tagName === "h1");
    expect(heading?.staticVisibleText).toContain("Café");
    expect(heading?.staticVisibleText).toContain("ボタン");
  });
});
