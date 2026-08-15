import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("Angular bindings", () => {
  it("tracks dynamic bindings and static attributes separately", async () => {
    const catalog = await fixtureCatalog();
    const bindings = catalog.templates.find((template) => template.ownerComponent === "BindingsComponent");
    const dynamicButton = bindings?.elements.find((element) => element.tagName === "button" && element.dynamicAttributeNames.length > 0);
    const staticButton = bindings?.elements.find((element) => element.staticAttributes["aria-label"] === "Static label");
    expect(dynamicButton?.dynamicAttributeNames.length).toBeGreaterThan(0);
    expect(staticButton).toBeDefined();
    expect(catalog.summary.eventBindings).toBeGreaterThan(0);
    expect(catalog.summary.twoWayBindings).toBeGreaterThan(0);
  });
});

describe("Angular control flow", () => {
  it("catalogs elements inside control flow blocks", async () => {
    const catalog = await fixtureCatalog();
    const template = catalog.templates.find((entry) => entry.ownerComponent === "ControlFlowComponent");
    expect(template?.elements.some((element) => element.staticAttributes.id === "ready-btn")).toBe(true);
    expect(template?.elements.some((element) => element.hasConditionalRendering)).toBe(true);
    expect(template?.elements.some((element) => element.hasDeferredRendering)).toBe(true);
    expect(catalog.summary.controlFlowBlocks).toBeGreaterThan(0);
  });
});

describe("Angular selectors", () => {
  it("accepts supported native selectors", async () => {
    const { parseAngularSelector } = await import("@a11yst/source-mapping-angular");
    expect(parseAngularSelector("button#submit-order").ok).toBe(true);
  });
});
