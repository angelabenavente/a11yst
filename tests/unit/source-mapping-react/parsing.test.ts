import { describe, expect, it } from "vitest";
import { fixtureCatalog, findElement } from "./helpers.js";

describe("React parsing", () => {
  it("indexes function, arrow, class, member, ternary, map, and fragment contexts", async () => {
    const catalog = await fixtureCatalog();
    const checkoutButton = findElement(
      catalog,
      "CheckoutButton.tsx",
      (element) => element.staticProps.id === "submit-order",
    );
    expect(checkoutButton?.ownerComponent).toBe("CheckoutButton");
    expect(checkoutButton?.elementKind).toBe("intrinsic");

    const classButton = findElement(
      catalog,
      "ClassComponent.tsx",
      (element) => element.staticProps.id === "class-submit",
    );
    expect(classButton?.ownerComponent).toBe("ClassComponent");

    const member = findElement(
      catalog,
      "ComponentUsages.tsx",
      (element) => element.componentName === "UI.Button",
    );
    expect(member?.elementKind).toBe("component");

    const mapped = catalog.files
      .flatMap((file) => file.elements)
      .filter((element) => element.tagName === "button" && element.ownerComponent === "CheckoutForm");
    expect(mapped.length).toBeGreaterThan(0);
  });

  it("ignores React fragments as catalog elements", async () => {
    const catalog = await fixtureCatalog();
    expect(
      catalog.files
        .flatMap((file) => file.elements)
        .some((element) => element.componentName === "Fragment"),
    ).toBe(false);
  });

  it("records parse failure for malformed fixture without stopping the catalog", async () => {
    const catalog = await fixtureCatalog();
    expect(catalog.summary.failedFiles).toBeGreaterThanOrEqual(1);
    expect(catalog.diagnostics.some((entry) => entry.code === "react-parse-failed")).toBe(true);
    expect(catalog.files.some((file) => file.uri === "Malformed.tsx")).toBe(false);
  });
});
