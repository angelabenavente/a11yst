import { describe, expect, it } from "vitest";
import { mapReactSource } from "@a11yst/source-mapping-react";
import { fixtureCatalog } from "./helpers.js";

describe("React source matching", () => {
  it("matches unique ids and duplicate ids conservatively", async () => {
    const catalog = await fixtureCatalog();
    const unique = mapReactSource({
      catalog,
      evidence: { elementId: "legacy-submit", tagName: "button" },
    });
    expect(unique.status).toBe("mapped");
    expect(unique.selected?.confidence).toBe("high");

    const duplicate = mapReactSource({
      catalog,
      evidence: { elementId: "duplicate-id" },
    });
    expect(duplicate.status).toBe("ambiguous");
  });

  it("does not create candidates from tag alone", async () => {
    const catalog = await fixtureCatalog();
    const result = mapReactSource({
      catalog,
      evidence: { tagName: "button" },
    });
    expect(result.status).toBe("unmapped");
  });

  it("matches stable attributes and component usages", async () => {
    const catalog = await fixtureCatalog();
    const attribute = mapReactSource({
      catalog,
      evidence: {
        tagName: "button",
        attributes: { "data-testid": "checkout-button" },
      },
    });
    expect(attribute.status).toBe("mapped");
    expect(attribute.selected?.confidence).toBe("high");

    const component = mapReactSource({
      catalog,
      evidence: { componentName: "UI.Button", attributes: { id: "ui-button" } },
    });
    expect(component.status).toBe("mapped");
    expect(component.selected?.confidence).toBe("high");
  });

  it("uses ownerComponent as a filter only", async () => {
    const catalog = await fixtureCatalog();
    const filtered = mapReactSource({
      catalog,
      evidence: {
        selector: "button#submit-order",
        ownerComponent: "CheckoutButton",
      },
    });
    expect(filtered.status).toBe("mapped");

    const unknownOwner = mapReactSource({
      catalog,
      evidence: {
        ownerComponent: "MissingOwner",
      },
    });
    expect(unknownOwner.status).toBe("unmapped");
  });

  it("uses existing source locations before react heuristics", async () => {
    const catalog = await fixtureCatalog();
    const result = mapReactSource({
      catalog,
      evidence: {
        selector: "button#submit-order",
        existingSourceLocation: {
          uri: "CheckoutButton.tsx",
          startLine: 9,
          startColumn: 7,
        },
      },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("exact");
    expect(result.selected?.provenance).toBe("existing-source-location");
    expect(result.candidates).toHaveLength(1);
  });
});
