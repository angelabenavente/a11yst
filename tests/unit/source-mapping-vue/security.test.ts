import { describe, expect, it } from "vitest";
import { stableSerializeVueCatalog } from "@a11yst/source-mapping-vue";
import { fixtureCatalog } from "./helpers.js";

describe("Vue security", () => {
  it("redacts sensitive literals from catalog serialization", async () => {
    const catalog = await fixtureCatalog();
    const serialized = stableSerializeVueCatalog(catalog);
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toContain("<template");
  });
});
