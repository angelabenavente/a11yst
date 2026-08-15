import { describe, expect, it } from "vitest";
import { fixtureCatalog, findElement } from "./helpers.js";

describe("React component ownership", () => {
  it("detects named function, arrow, and class owners", async () => {
    const catalog = await fixtureCatalog();
    expect(
      findElement(catalog, "CheckoutButton.tsx", (element) => element.tagName === "button")
        ?.ownerComponent,
    ).toBe("CheckoutButton");
    expect(
      findElement(catalog, "CheckoutForm.tsx", (element) => element.staticProps.id === "email")
        ?.ownerComponent,
    ).toBe("CheckoutForm");
    expect(
      findElement(catalog, "ClassComponent.tsx", (element) => element.tagName === "button")
        ?.ownerComponent,
    ).toBe("ClassComponent");
  });

  it("does not resolve imports or fabricate owners", async () => {
    const catalog = await fixtureCatalog();
    const usage = findElement(
      catalog,
      "CheckoutForm.tsx",
      (element) => element.componentName === "CheckoutButton",
    );
    expect(usage?.ownerComponent).toBe("CheckoutForm");
    expect(usage?.componentName).toBe("CheckoutButton");
  });
});
