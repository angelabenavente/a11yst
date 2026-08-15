import { describe, expect, it } from "vitest";
import { validateSourceRegion } from "@a11yst/source-mapping";
import { fixtureCatalog, findElement } from "./helpers.js";

describe("React source locations", () => {
  it("points to the jsx opening element with 1-based columns", async () => {
    const catalog = await fixtureCatalog();
    const element = findElement(
      catalog,
      "CheckoutButton.tsx",
      (entry) => entry.staticProps.id === "submit-order",
    );
    expect(element?.region.start.line).toBeGreaterThan(1);
    expect(element?.region.start.column).toBeGreaterThanOrEqual(1);
    expect(() => validateSourceRegion(element!.region)).not.toThrow();
  });

  it("does not use owner component or file start as the location", async () => {
    const catalog = await fixtureCatalog();
    const element = findElement(
      catalog,
      "CheckoutButton.tsx",
      (entry) => entry.staticProps.id === "submit-order",
    );
    expect(element?.region.start.line).not.toBe(1);
    expect(element?.region.start.line).toBeLessThan(20);
  });

  it("includes end locations for multiline opening tags", async () => {
    const catalog = await fixtureCatalog();
    const element = findElement(
      catalog,
      "CheckoutButton.tsx",
      (entry) => entry.staticProps.id === "submit-order",
    );
    expect(element?.region.end?.line).toBeGreaterThanOrEqual(element!.region.start.line);
  });
});
