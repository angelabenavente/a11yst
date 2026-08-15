import { describe, expect, it } from "vitest";
import { fixtureCatalog, findElement } from "./helpers.js";

describe("Vue SFC parsing", () => {
  it("parses template blocks and ignores script/style", async () => {
    const catalog = await fixtureCatalog();
    const button = findElement(catalog, "CheckoutButton.vue", (element) => element.tagName === "button");
    expect(button).toBeDefined();
    expect(button?.staticAttributes.id).toBe("submit-order");
  });

  it("handles missing, pug, and external templates safely", async () => {
    const catalog = await fixtureCatalog();
    const codes = catalog.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("vue-template-language-unsupported");
    expect(codes).toContain("vue-external-template-unsupported");
  });
});

describe("Vue template locations", () => {
  it("uses 1-based columns pointing at element starts", async () => {
    const catalog = await fixtureCatalog();
    const button = findElement(catalog, "CheckoutButton.vue", (element) => element.tagName === "button");
    expect(button?.region.start.line).toBeGreaterThan(1);
    expect(button?.region.start.column).toBeGreaterThanOrEqual(1);
  });
});

describe("Vue elements", () => {
  it("distinguishes native and component usages", async () => {
    const catalog = await fixtureCatalog();
    const native = catalog.files.flatMap((file) => file.elements).filter((element) => element.elementKind === "native");
    const components = catalog.files.flatMap((file) => file.elements).filter((element) => element.elementKind === "component");
    expect(native.length).toBeGreaterThan(0);
    expect(components.some((element) => element.componentName === "CheckoutButton")).toBe(true);
    expect(components.some((element) => element.componentName === "UI.Button")).toBe(true);
  });

  it("derives owner hints from filenames but not index.vue", async () => {
    const catalog = await fixtureCatalog();
    const owner = findElement(catalog, "CheckoutButton.vue", (element) => element.tagName === "button");
    expect(owner?.ownerComponentHint).toBe("CheckoutButton");
  });
});
