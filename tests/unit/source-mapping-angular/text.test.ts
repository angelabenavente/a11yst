import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("Angular static text", () => {
  it("derives static visible text for simple and nested content", async () => {
    const catalog = await fixtureCatalog();
    const checkout = catalog.templates.find((entry) => entry.uri.endsWith("checkout.component.html"));
    const submit = checkout?.elements.find((element) => element.staticAttributes.id === "submit-order");
    expect(submit?.staticVisibleText).toBe("Place order");
  });

  it("omits text when interpolation is present", async () => {
    const catalog = await fixtureCatalog();
    const bindings = catalog.templates.find((entry) => entry.ownerComponent === "BindingsComponent");
    const dynamicButton = bindings?.elements.find((element) => element.dynamicAttributeNames.length > 0);
    expect(dynamicButton?.staticVisibleText).toBeUndefined();
  });
});

describe("Angular static accessible name", () => {
  it("uses aria-label and button text as hints", async () => {
    const catalog = await fixtureCatalog();
    const checkout = catalog.templates.find((entry) => entry.uri.endsWith("checkout.component.html"));
    const submit = checkout?.elements.find((element) => element.staticAttributes.id === "submit-order");
    expect(submit?.staticAccessibleName).toBe("Place order");
  });
});
