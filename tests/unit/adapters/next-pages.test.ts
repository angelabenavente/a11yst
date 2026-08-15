import { describe, expect, it } from "vitest";
import { discoverNextRoutesFromPaths, nextAdapter, walkFiles } from "@a11yst/adapters";
import { adapterContext, adapterFixture } from "../../helpers/adapters.js";

describe("Next.js Pages Router discovery", () => {
  it("discovers static pages and excludes api routes", () => {
    const root = adapterFixture("next/pages-router");
    const paths = walkFiles(root)
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.relativePath);
    const { pagesRoutes, skippedPatterns } = discoverNextRoutesFromPaths({ relativePaths: paths });

    expect(pagesRoutes.map((route) => route.path).sort()).toEqual(["/", "/about"]);
    expect(skippedPatterns.map((entry) => entry.pattern)).toEqual(["/blog/:slug"]);
    expect(paths.some((path) => path.includes("pages/api/hello.ts"))).toBe(true);
    expect(pagesRoutes.some((route) => route.path.startsWith("/api"))).toBe(false);
  });

  it("marks pages routes with filesystem origin via the adapter", async () => {
    const context = adapterContext("next/pages-router", "next");
    const discovery = await nextAdapter.discoverRoutes(context);

    expect(discovery.routes.map((route) => route.path).sort()).toEqual(["/", "/about"]);
    expect(discovery.routes.every((route) => route.origin === "filesystem")).toBe(true);
    expect(discovery.skippedPatterns?.map((entry) => entry.pattern)).toEqual(["/blog/:slug"]);
  });
});
