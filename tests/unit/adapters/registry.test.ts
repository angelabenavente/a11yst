import { describe, expect, it } from "vitest";
import {
  listAdapters,
  resolveAdapter,
  isGenericWebFramework,
} from "@a11yst/adapters";

describe("@a11yst/adapters registry", () => {
  it("selects next instead of react", () => {
    const adapter = resolveAdapter({ framework: "next", platform: "web" });
    expect(adapter?.id).toBe("next");
    expect(adapter?.framework).toBe("next");
    expect(resolveAdapter({ framework: "react", platform: "web" })?.id).toBe("react");
  });

  it("selects nuxt instead of vue", () => {
    expect(resolveAdapter({ framework: "nuxt", platform: "web" })?.framework).toBe("nuxt");
    expect(resolveAdapter({ framework: "vue", platform: "web" })?.framework).toBe("vue");
  });

  it("routes preview and runtime-compatible frameworks to generic-web", () => {
    for (const framework of ["svelte", "astro", "lit", "unknown"] as const) {
      const adapter = resolveAdapter({ framework, platform: "web" });
      expect(adapter?.id).toBe("generic-web");
      expect(isGenericWebFramework(framework)).toBe(true);
    }
  });

  it("lists adapters with unique ids deterministically", () => {
    const adapters = listAdapters();
    const ids = adapters.map((adapter) => adapter.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    expect(ids).toEqual(
      expect.arrayContaining(["html", "react", "next", "angular", "vue", "nuxt", "generic-web"]),
    );
  });
});
