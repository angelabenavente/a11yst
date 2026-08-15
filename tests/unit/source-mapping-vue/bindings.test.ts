import { describe, expect, it } from "vitest";
import { fixtureCatalog, findElement } from "./helpers.js";

describe("Vue bindings", () => {
  it("captures static attributes and dynamic bindings separately", async () => {
    const catalog = await fixtureCatalog();
    const button = findElement(catalog, "CheckoutButton.vue", (element) => element.tagName === "button");
    expect(button?.staticAttributes["aria-label"]).toBe("Place order");
    expect(button?.dynamicAttributeNames.length).toBeGreaterThan(0);
    expect(button?.hasSpreadBinding).toBe(true);
  });

  it("excludes sensitive and unsupported attributes", async () => {
    const catalog = await fixtureCatalog();
    const sensitive = catalog.files.find((file) => file.uri === "Sensitive.vue");
    const button = sensitive?.elements.find((element) => element.tagName === "button");
    expect(button?.staticAttributes.value).toBeUndefined();
  });
});

describe("Vue static text", () => {
  it("extracts nested static text and ignores interpolations", async () => {
    const catalog = await fixtureCatalog();
    const nested = catalog.files.find((file) => file.uri === "NestedText.vue");
    const staticButton = nested?.elements.find(
      (element) => element.tagName === "button" && element.staticVisibleText === "Place order",
    );
    expect(staticButton).toBeDefined();
    const dynamicButton = nested?.elements.find(
      (element) => element.tagName === "button" && element.staticVisibleText === undefined,
    );
    expect(dynamicButton).toBeDefined();
  });
});
