import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("Angular inline templates", () => {
  it("maps inline elements to the component TypeScript URI", async () => {
    const catalog = await fixtureCatalog();
    const template = catalog.templates.find((entry) => entry.ownerComponent === "InlineCheckoutComponent");
    expect(template?.uri).toBe("inline/inline-checkout.component.ts");
    expect(template?.templateKind).toBe("inline");
  });

  it("supports multiline opening tags and nested elements", async () => {
    const catalog = await fixtureCatalog();
    const button = templateElement(catalog, "inline/inline-checkout.component.ts", "inline-submit");
    expect(button?.region.start.line).toBeGreaterThan(1);
    expect(button?.staticAccessibleName).toBe("Place order");
  });
});

function templateElement(
  catalog: Awaited<ReturnType<typeof fixtureCatalog>>,
  uri: string,
  id: string,
) {
  for (const template of catalog.templates) {
    if (template.uri !== uri) {
      continue;
    }
    return template.elements.find((element) => element.staticAttributes.id === id);
  }
  return undefined;
}
