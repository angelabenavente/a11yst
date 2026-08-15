import { describe, expect, it } from "vitest";
import {
  discoverNextRoutesFromPaths,
  mergeAppAndPagesRoutes,
  nextAdapter,
  walkFiles,
} from "@a11yst/adapters";
import { adapterContext, adapterFixture } from "../../helpers/adapters.js";

describe("next route discovery", () => {
  it("discovers App Router static routes and skips dynamic segments", () => {
    const root = adapterFixture("next/app-router");
    const paths = walkFiles(root).filter((e) => !e.isDirectory).map((e) => e.relativePath);
    const { appRoutes, skippedPatterns } = discoverNextRoutesFromPaths({ relativePaths: paths });

    expect(appRoutes.map((route) => route.path).sort()).toEqual(["/", "/about", "/pricing"]);
    expect(skippedPatterns.map((entry) => entry.pattern).sort()).toEqual([
      "/blog/:slug",
      "/docs/:...slug",
    ]);
  });

  it("discovers Pages Router routes and excludes api routes", () => {
    const root = adapterFixture("next/pages-router");
    const paths = walkFiles(root).filter((e) => !e.isDirectory).map((e) => e.relativePath);
    const { pagesRoutes, skippedPatterns } = discoverNextRoutesFromPaths({ relativePaths: paths });

    expect(pagesRoutes.map((route) => route.path).sort()).toEqual(["/", "/about"]);
    expect(skippedPatterns.map((entry) => entry.pattern)).toEqual(["/blog/:slug"]);
    expect(paths.some((path) => path.includes("pages/api/hello.ts"))).toBe(true);
  });

  it("reports collisions for hybrid app/pages projects", async () => {
    const context = adapterContext("next/hybrid", "next");
    const discovery = await nextAdapter.discoverRoutes(context);

    expect(discovery.routes.map((route) => route.path)).toContain("/about");
    expect(discovery.diagnostics.some((d) => d.code === "NEXT_ROUTE_COLLISION")).toBe(true);
    expect(discovery.diagnostics.some((d) => d.code === "NEXT_HYBRID_ROUTER")).toBe(true);
  });

  it("mergeAppAndPagesRoutes dedupes by path", () => {
    const merged = mergeAppAndPagesRoutes(
      [{ path: "/", pattern: "/", hasDynamic: false }],
      [
        { path: "/", pattern: "/", hasDynamic: false },
        { path: "/about", pattern: "about", hasDynamic: false },
      ],
    );
    expect(merged.routes.map((route) => route.path)).toEqual(["/", "/about"]);
    expect(merged.collisions).toEqual(["/"]);
  });
});
