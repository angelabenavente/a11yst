import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("Angular control flow", () => {
  it("catalogs elements inside built-in control flow blocks", async () => {
    const catalog = await fixtureCatalog();
    const template = catalog.templates.find((entry) => entry.ownerComponent === "ControlFlowComponent");
    expect(template?.elements.some((element) => element.staticAttributes.id === "ready-btn")).toBe(true);
    expect(template?.elements.some((element) => element.hasConditionalRendering)).toBe(true);
    expect(template?.elements.some((element) => element.hasRepeatedRendering)).toBe(true);
    expect(template?.elements.some((element) => element.hasDeferredRendering)).toBe(true);
  });
});
