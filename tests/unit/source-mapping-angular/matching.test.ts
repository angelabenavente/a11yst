import { describe, expect, it } from "vitest";
import { mapAngularSource } from "@a11yst/source-mapping-angular";
import { fixtureCatalog } from "./helpers.js";

describe("Angular selector matching", () => {
  it("maps unique selector to high confidence on external template", async () => {
    const catalog = await fixtureCatalog();
    const result = mapAngularSource({
      catalog,
      evidence: { selector: "button#submit-order", templateKind: "external" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.confidence).toBe("high");
    expect(result.selected?.location.uri).toContain("checkout.component.html");
    expect(result.selected?.framework).toBe("angular");
  });

  it("returns ambiguous for duplicate selectors across templates", async () => {
    const catalog = await fixtureCatalog();
    const result = mapAngularSource({
      catalog,
      evidence: { selector: "button#dup-id" },
    });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });
});

describe("Angular mapping", () => {
  it("preserves exact mappings from existing source location", async () => {
    const catalog = await fixtureCatalog();
    const result = mapAngularSource({
      catalog,
      evidence: {
        existingSourceLocation: {
          uri: "external/checkout.component.html",
          startLine: 2,
          startColumn: 3,
        },
      },
    });
    expect(result.selected?.confidence).toBe("exact");
  });

  it("maps inline template selector to TypeScript URI", async () => {
    const catalog = await fixtureCatalog();
    const result = mapAngularSource({
      catalog,
      evidence: { selector: "button#inline-submit", templateKind: "inline" },
    });
    expect(result.status).toBe("mapped");
    expect(result.selected?.location.uri.endsWith(".ts")).toBe(true);
    expect(result.selected?.angular?.templateKind).toBe("inline");
  });
});
