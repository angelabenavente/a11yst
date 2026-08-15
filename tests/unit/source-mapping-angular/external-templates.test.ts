import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("Angular external templates", () => {
  it("resolves relative templateUrl against component directory", async () => {
    const catalog = await fixtureCatalog();
    const template = catalog.templates.find((entry) => entry.uri === "external/checkout.component.html");
    expect(template?.ownerSourceUri).toBe("external/checkout.component.ts");
    expect(template?.ownerComponent).toBe("CheckoutComponent");
  });

  it("uses html language locations on external templates", async () => {
    const catalog = await fixtureCatalog();
    const template = catalog.templates.find((entry) => entry.uri.endsWith("checkout.component.html"));
    expect(template?.elements.some((element) => element.templateKind === "external")).toBe(true);
  });
});
