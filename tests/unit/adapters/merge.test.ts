import { describe, expect, it } from "vitest";
import { applyDynamicSamples, resolveProjectRoutes } from "@a11yst/adapters";

const explicit = [{ id: "custom", name: "Custom", path: "/custom" }];

describe("resolveProjectRoutes", () => {
  it("returns explicit routes only in off mode", () => {
    const result = resolveProjectRoutes({
      explicitRoutes: explicit,
      mode: "off",
      discovery: {
        routes: [
          {
            id: "root",
            name: "Home",
            path: "/",
            origin: "filesystem",
            dynamic: false,
          },
        ],
        skippedPatterns: [{ pattern: "/users/:id", reason: "dynamic-segment" }],
        diagnostics: [],
      },
    });

    expect(result.routes).toEqual(explicit);
    expect(result.skippedPatterns.map((entry) => entry.pattern)).toEqual(["/users/:id"]);
  });

  it("uses discovery as fallback when explicit routes are empty", () => {
    const result = resolveProjectRoutes({
      explicitRoutes: [],
      mode: "fallback",
      discovery: {
        routes: [
          {
            id: "root",
            name: "Home",
            path: "/",
            origin: "filesystem",
            dynamic: false,
          },
          {
            id: "about",
            name: "About",
            path: "/about",
            origin: "adapter-default",
            dynamic: false,
          },
        ],
        skippedPatterns: [],
        diagnostics: [],
      },
    });

    expect(result.routes.map((route) => route.path)).toEqual(["/", "/about"]);
  });

  it("ignores discovery in fallback mode when explicit routes exist", () => {
    const result = resolveProjectRoutes({
      explicitRoutes: explicit,
      mode: "fallback",
      discovery: {
        routes: [
          {
            id: "root",
            name: "Home",
            path: "/",
            origin: "filesystem",
            dynamic: false,
          },
        ],
        skippedPatterns: [],
        diagnostics: [],
      },
    });

    expect(result.routes).toEqual(explicit);
  });

  it("merges tiers with explicit precedence in merge mode", () => {
    const result = resolveProjectRoutes({
      explicitRoutes: explicit,
      mode: "merge",
      discovery: {
        routes: [
          {
            id: "root",
            name: "Home",
            path: "/",
            origin: "filesystem",
            dynamic: false,
          },
          {
            id: "about",
            name: "About",
            path: "/about",
            origin: "filesystem",
            dynamic: false,
          },
        ],
        skippedPatterns: [{ pattern: "/users/:id", reason: "dynamic-segment" }],
        diagnostics: [],
      },
      samples: {
        "/users/:id": ["/users/1"],
      },
    });

    expect(result.routes.map((route) => route.path)).toEqual(["/custom", "/", "/about", "/users/1"]);
    expect(result.skippedPatterns).toEqual([]);
  });
});

describe("applyDynamicSamples", () => {
  it("expands patterns using configured samples and validates paths", () => {
    const result = applyDynamicSamples({
      skippedPatterns: [
        { pattern: "/posts/:slug", reason: "dynamic-segment" },
        { pattern: "/missing/:id", reason: "dynamic-segment" },
      ],
      samples: {
        "/posts/:slug": ["/posts/hello", "invalid"],
        "/missing/:id": [],
      },
    });

    expect(result.routes.map((route) => route.path)).toEqual(["/posts/hello"]);
    expect(result.skippedPatterns.map((entry) => entry.pattern)).toEqual(["/missing/:id"]);
    expect(result.diagnostics.some((d) => d.code === "ROUTE_SAMPLE_INVALID")).toBe(true);
  });
});
