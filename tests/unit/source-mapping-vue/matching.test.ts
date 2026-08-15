import { describe, expect, it } from "vitest";
import { mapVueSource } from "@a11yst/source-mapping-vue";
import { fixtureCatalog } from "./helpers.js";

describe("Vue selector matching", () => {
  it("maps a unique selector to high confidence", async () => {
    const catalog = await fixtureCatalog();
    const result = mapVueSource({
      catalog,
      evidence: { selector: "button#submit-order" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("high");
    expect(result.selected?.provenance).toBe("selector-match");
    expect(result.selected?.location.uri).toBe("CheckoutButton.vue");
  });

  it("returns ambiguous for duplicate selectors", async () => {
    const catalog = await fixtureCatalog();
    const result = mapVueSource({
      catalog,
      evidence: { selector: "button#dup-a" },
    });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });
});

describe("Vue mapping", () => {
  it("maps unique component usages to medium confidence", async () => {
    const catalog = await fixtureCatalog();
    const result = mapVueSource({
      catalog,
      evidence: { componentName: "UI.Button" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("medium");
    expect(result.selected?.framework).toBe("vue");
    expect(result.selected?.adapter).toBe("vue-sfc-static");
  });

  it("preserves exact mappings from existing source location", async () => {
    const catalog = await fixtureCatalog();
    const result = mapVueSource({
      catalog,
      evidence: {
        existingSourceLocation: {
          uri: "CheckoutButton.vue",
          startLine: 2,
          startColumn: 3,
        },
      },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("exact");
  });
});
