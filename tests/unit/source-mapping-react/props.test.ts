import { describe, expect, it } from "vitest";
import { fixtureCatalog, findElement } from "./helpers.js";

describe("React static props", () => {
  it("extracts literals, boolean shorthand, numeric, and static templates", async () => {
    const catalog = await fixtureCatalog();
    const submit = findElement(
      catalog,
      "CheckoutButton.tsx",
      (element) => element.staticProps.id === "submit-order",
    );
    expect(submit?.staticProps["aria-label"]).toBe("Place order");
    expect(submit?.staticProps.disabled).toBe(false);
    expect(submit?.staticProps["data-testid"]).toBe("checkout-button");
    expect(submit?.classNames).toEqual(["btn", "btn-primary"]);
    expect(submit?.hasSpreadProps).toBe(true);
    expect(submit?.spreadBeforeStaticProps).toBe(true);
  });

  it("marks dynamic children without storing expressions", async () => {
    const catalog = await fixtureCatalog();
    const dynamic = findElement(
      catalog,
      "CheckoutButton.tsx",
      (element) => element.tagName === "button" && element.dynamicPropNames.length === 0 && !element.staticVisibleText,
    );
    expect(dynamic).toBeDefined();
    const serialized = JSON.stringify(catalog);
    expect(serialized.includes("buttonId")).toBe(false);
  });

  it("excludes value, style, dangerouslySetInnerHTML, and event handlers", async () => {
    const catalog = await fixtureCatalog();
    const serialized = JSON.stringify(catalog);
    expect(serialized.includes("onClick")).toBe(false);
    expect(serialized.includes("dangerouslySetInnerHTML")).toBe(false);
    expect(serialized.includes("SuperSecretPassword123")).toBe(false);
    expect(serialized.includes("style")).toBe(false);
  });

  it("rejects javascript href values", async () => {
    const catalog = await fixtureCatalog();
    const anchor = catalog.files
      .flatMap((file) => file.elements)
      .find((element) => element.tagName === "a");
    expect(anchor?.staticProps.href).toBeUndefined();
    expect(anchor?.dynamicPropNames).toContain("href");
  });
});
