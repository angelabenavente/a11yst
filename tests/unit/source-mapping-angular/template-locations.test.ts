import { describe, expect, it } from "vitest";
import { fixtureCatalog, findElement } from "./helpers.js";

describe("Angular template locations", () => {
  it("uses 1-based columns for external templates", async () => {
    const catalog = await fixtureCatalog();
    const button = findElement(catalog, "external/checkout.component.html", (element) => element.staticAttributes.id === "submit-order");
    expect(button?.region.start.line).toBeGreaterThanOrEqual(2);
    expect(button?.region.start.column).toBeGreaterThanOrEqual(1);
  });

  it("maps inline template locations into the TypeScript file", async () => {
    const catalog = await fixtureCatalog();
    const button = findElement(catalog, "inline/inline-checkout.component.ts", (element) => element.staticAttributes.id === "inline-submit");
    expect(button?.templateKind).toBe("inline");
    expect(button?.region.start.line).toBeGreaterThan(1);
  });
});
