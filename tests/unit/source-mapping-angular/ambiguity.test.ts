import { describe, expect, it } from "vitest";
import { mapAngularSource } from "@a11yst/source-mapping-angular";
import { fixtureCatalog } from "./helpers.js";

describe("Angular ambiguity", () => {
  it("returns ambiguous for duplicate selectors across templates", async () => {
    const catalog = await fixtureCatalog();
    const result = mapAngularSource({ catalog, evidence: { selector: "button#dup-id" } });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
    expect(result.candidates.length).toBeGreaterThan(1);
  });

  it("returns ambiguous for same selector in two scopes without hint", async () => {
    const catalog = await fixtureCatalog(["scope-a", "scope-b"]);
    const result = mapAngularSource({
      catalog,
      evidence: { selector: "button#submit-order", templateKind: "inline" },
    });
    expect(result.status).toBe("ambiguous");
    expect(result.selected).toBeUndefined();
  });
});
