import { describe, expect, it } from "vitest";
import { discoverNuxtRoutesFromPaths, nuxtAdapter, walkFiles } from "@a11yst/adapters";
import { adapterContext, adapterFixture } from "../../helpers/adapters.js";

describe("nuxt route discovery", () => {
  it("discovers static pages and skips dynamic segments", () => {
    const root = adapterFixture("nuxt");
    const paths = walkFiles(root).filter((entry) => !entry.isDirectory).map((entry) => entry.relativePath);
    const { routes, skippedPatterns } = discoverNuxtRoutesFromPaths(paths);

    expect(routes.map((route) => route.path).sort()).toEqual(["/", "/about"]);
    expect(skippedPatterns.map((entry) => entry.pattern)).toEqual(["/users/:id"]);
  });

  it("integrates with nuxt adapter discovery", async () => {
    const context = adapterContext("nuxt", "nuxt");
    const discovery = await nuxtAdapter.discoverRoutes(context);
    expect(discovery.routes.map((route) => route.path).sort()).toEqual(["/", "/about"]);
  });
});
