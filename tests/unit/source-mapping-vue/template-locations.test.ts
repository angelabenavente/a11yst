import { describe, expect, it } from "vitest";
import { fixtureCatalog, findElement } from "./helpers.js";

describe("Vue template locations", () => {
  it("points at multiline opening tags within the SFC", async () => {
    const catalog = await fixtureCatalog();
    const button = findElement(catalog, "CheckoutButton.vue", (element) => element.tagName === "button");
    expect(button?.region.start.line).toBe(2);
    expect(button?.region.end?.line).toBeGreaterThanOrEqual(2);
  });
});
