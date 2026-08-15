import { describe, expect, it } from "vitest";
import { fixtureCatalog, fixtureSourceIndex } from "./helpers.js";

describe("Angular source catalog", () => {
  it("indexes TypeScript and angular-template files from source index", async () => {
    const catalog = await fixtureCatalog();
    expect(catalog.components.length).toBeGreaterThan(0);
    expect(catalog.templates.length).toBeGreaterThan(0);
    expect(catalog.summary.parsedTypeScriptFiles).toBeGreaterThan(0);
  });

  it("associates external templates only when referenced by templateUrl", async () => {
    const catalog = await fixtureCatalog();
    expect(catalog.summary.externalTemplates).toBeGreaterThan(0);
    expect(catalog.summary.unassociatedTemplates).toBe(0);
  });

  it("does not mutate source index input", () => {
    const before = structuredClone(fixtureSourceIndex());
    expect(fixtureSourceIndex()).toEqual(before);
  });
});
