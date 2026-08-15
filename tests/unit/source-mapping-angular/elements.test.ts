import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("Angular elements", () => {
  it("distinguishes native and component usages", async () => {
    const catalog = await fixtureCatalog();
    const elements = catalog.templates.flatMap((template) => template.elements);
    expect(elements.some((element) => element.elementKind === "native" && element.tagName === "button")).toBe(true);
    expect(elements.some((element) => element.elementKind === "component" && element.componentSelector === "app-checkout-button")).toBe(true);
  });

  it("ignores ng-container as DOM element but keeps descendants", async () => {
    const catalog = await fixtureCatalog();
    const structural = catalog.templates.find((template) => template.ownerComponent === "StructuralComponent");
    expect(structural?.elements.some((element) => element.tagName === "ng-container")).toBe(false);
    expect(structural?.elements.some((element) => element.staticAttributes.id === "inside-container")).toBe(true);
  });
});
