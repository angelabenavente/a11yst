import { describe, expect, it } from "vitest";
import { mapReactSource } from "@a11yst/source-mapping-react";
import { fixtureCatalog } from "./helpers.js";

describe("React mapping ambiguity", () => {
  it("never selects when multiple distinct candidates remain", async () => {
    const catalog = await fixtureCatalog();
    const duplicateComponents = mapReactSource({
      catalog,
      evidence: { componentName: "CheckoutButton" },
    });
    expect(duplicateComponents.status).toBe("ambiguous");
    expect(duplicateComponents.selected).toBeUndefined();

    const duplicateText = mapReactSource({
      catalog,
      evidence: { tagName: "button", visibleText: "Continue" },
    });
    expect(duplicateText.status).toBe("ambiguous");
  });

  it("does not prefer first file, shortest path, or higher confidence", async () => {
    const catalog = await fixtureCatalog();
    const result = mapReactSource({
      catalog,
      evidence: { selector: "button#duplicate-id" },
    });
    expect(result.selected).toBeUndefined();
    expect(result.candidates.length).toBeGreaterThan(1);
  });
});
