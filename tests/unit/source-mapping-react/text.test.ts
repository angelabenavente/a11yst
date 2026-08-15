import { describe, expect, it } from "vitest";
import { fixtureCatalog, findElement } from "./helpers.js";

describe("React static text and accessible name hints", () => {
  it("derives static visible text from jsx text and literal expressions", async () => {
    const catalog = await fixtureCatalog();
    const submit = findElement(
      catalog,
      "CheckoutButton.tsx",
      (element) => element.staticProps.id === "submit-order",
    );
    expect(submit?.staticVisibleText).toBe("Place order");
    expect(submit?.staticAccessibleName).toBe("Place order");
  });

  it("concatenates nested intrinsic text conservatively", async () => {
    const catalog = await fixtureCatalog();
    const legacy = findElement(
      catalog,
      "LegacyButton.jsx",
      (element) => element.staticProps.id === "legacy-submit",
    );
    expect(legacy?.staticVisibleText).toBe("Submit order");
  });

  it("ignores dynamic identifiers and keeps accessible names as hints only", async () => {
    const catalog = await fixtureCatalog();
    const dynamic = findElement(
      catalog,
      "CheckoutButton.tsx",
      (element) => element.tagName === "button" && !element.staticVisibleText,
    );
    expect(dynamic?.staticVisibleText).toBeUndefined();
  });
});
