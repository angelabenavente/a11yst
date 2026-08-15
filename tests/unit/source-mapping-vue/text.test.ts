import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("Vue text", () => {
  it("normalizes nested static text", async () => {
    const catalog = await fixtureCatalog();
    const nested = catalog.files.find((file) => file.uri === "NestedText.vue");
    expect(
      nested?.elements.some(
        (element) => element.tagName === "button" && element.staticVisibleText === "Place order",
      ),
    ).toBe(true);
  });
});
