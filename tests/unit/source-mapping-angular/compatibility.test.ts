import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./helpers.js";

describe("Angular compatibility", () => {
  it("exposes catalog version 1", async () => {
    const catalog = await fixtureCatalog();
    expect(catalog.version).toBe(1);
  });
});
