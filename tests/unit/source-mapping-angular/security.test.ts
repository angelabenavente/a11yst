import { describe, expect, it } from "vitest";
import { stableSerializeAngularCatalog } from "@a11yst/source-mapping-angular";
import { fixtureCatalog } from "./helpers.js";

describe("Angular security", () => {
  it("does not serialize source code or sensitive literals", async () => {
    const catalog = await fixtureCatalog();
    const serialized = stableSerializeAngularCatalog(catalog);
    expect(serialized).not.toContain("@Component({");
    expect(serialized).not.toContain("Password123!");
    expect(serialized).not.toContain("Bearer secret-token");
    expect(serialized).not.toContain("javascript:alert");
    expect(serialized).not.toContain("handler()");
  });

  it("excludes value and innerHTML attributes from catalog", async () => {
    const catalog = await fixtureCatalog();
    const sensitive = catalog.templates.find((entry) => entry.ownerComponent === "SensitiveComponent");
    for (const element of sensitive?.elements ?? []) {
      expect(element.staticAttributes.value).toBeUndefined();
      expect(element.staticAttributes.innerHTML).toBeUndefined();
    }
  });
});
