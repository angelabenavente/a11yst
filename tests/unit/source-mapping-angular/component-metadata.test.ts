import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("Angular component metadata", () => {
  it("extracts class name, selector, templateUrl, and standalone flag", async () => {
    const catalog = await fixtureCatalog();
    const checkout = catalog.components.find((component) => component.className === "CheckoutComponent");
    expect(checkout?.selector).toBe("app-checkout");
    expect(checkout?.elementSelector).toBe("app-checkout");
    expect(checkout?.templateKind).toBe("external");
    expect(checkout?.standalone).toBe(true);
  });

  it("marks dynamic metadata without evaluating expressions", async () => {
    const catalog = await fixtureCatalog();
    const codes = catalog.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("angular-template-url-dynamic");
    expect(codes).toContain("angular-template-dynamic");
  });
});

describe("Angular external templates", () => {
  it("associates checkout.component.html with checkout.component.ts", async () => {
    const catalog = await fixtureCatalog();
    const template = catalog.templates.find((entry) => entry.uri.endsWith("checkout.component.html"));
    expect(template?.ownerComponent).toBe("CheckoutComponent");
    expect(template?.templateKind).toBe("external");
  });
});

describe("Angular inline templates", () => {
  it("catalogs inline template elements on the component TypeScript URI", async () => {
    const catalog = await fixtureCatalog();
    const template = catalog.templates.find((entry) => entry.ownerComponent === "InlineCheckoutComponent");
    expect(template?.templateKind).toBe("inline");
    expect(template?.uri.endsWith(".ts")).toBe(true);
    expect(template?.elements.some((element) => element.staticAttributes.id === "inline-submit")).toBe(true);
  });
});
