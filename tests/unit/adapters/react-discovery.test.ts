import { describe, expect, it } from "vitest";
import { validateConfig } from "@a11yst/config";
import { discoverReactRoutes, reactAdapter, resolveProjectRoutes } from "@a11yst/adapters";
import { createAuditPlan } from "@a11yst/core";
import { adapterContext, adapterFixture } from "../../helpers/adapters.js";

function discover(fixture: string) {
  const root = adapterFixture(`react/${fixture}`);
  const context = adapterContext(`react/${fixture}`, "react");
  return discoverReactRoutes(root, context.packageJson);
}

describe("discoverReactRoutes", () => {
  it("discovers JSX Routes", () => {
    const result = discover("jsx-routes");
    expect(result.routes.map((route) => route.path).sort()).toEqual([
      "/",
      "/about",
      "/contact",
    ]);
    expect(result.routes.every((route) => route.origin === "react-jsx-route")).toBe(true);
    expect(result.explain?.routerDetected).toBe(true);
    expect(result.explain?.fallbackUsed).toBe(false);
  });

  it("resolves nested and index routes", () => {
    const result = discover("nested-routes");
    expect(result.routes.map((route) => route.path).sort()).toEqual([
      "/contact",
      "/projects",
      "/projects/featured",
    ]);
  });

  it("discovers createBrowserRouter object routes", () => {
    const result = discover("create-browser-router");
    expect(result.routes.map((route) => route.path).sort()).toEqual([
      "/",
      "/archive",
      "/dashboard",
      "/settings",
      "/settings/profile",
    ]);
    expect(result.routes.every((route) => route.origin === "react-router-object")).toBe(true);
  });

  it("discovers useRoutes arrays and local path constants", () => {
    const result = discover("use-routes");
    expect(result.routes.map((route) => route.path).sort()).toEqual(["/", "/help", "/projects"]);
  });

  it("registers dynamic patterns without inventing concrete paths", () => {
    const result = discover("dynamic-route");
    expect(result.routes.map((route) => route.path)).toEqual(["/"]);
    expect(result.skippedPatterns.map((entry) => entry.pattern).sort()).toEqual([
      "/projects/:slug",
      "/users/:id",
    ]);
    expect(result.skippedPatterns.every((entry) => entry.reason === "requires configured value")).toBe(
      true,
    );
  });

  it("does not treat href, API, or asset strings as routes", () => {
    const result = discover("false-positives");
    expect(result.routes.map((route) => route.path)).toEqual(["/real"]);
    expect(result.routes.some((route) => route.path.includes("api"))).toBe(false);
    expect(result.routes.some((route) => route.path.includes("logo"))).toBe(false);
    expect(result.routes.some((route) => route.path === "/foo")).toBe(false);
  });

  it("records source file provenance", () => {
    const result = discover("jsx-routes");
    const about = result.routes.find((route) => route.path === "/about");
    expect(about?.sourceFile).toMatch(/src\/App\.tsx$/);
    expect(about?.sourceLine).toBeTypeOf("number");
  });
});

describe("reactAdapter discoverRoutes", () => {
  it("uses fallback only when no router routes are discovered", async () => {
    const context = adapterContext("react/no-router", "react");
    const discovery = await reactAdapter.discoverRoutes(context);

    expect(discovery.routes).toEqual([
      expect.objectContaining({ path: "/", origin: "adapter-default" }),
    ]);
    expect(discovery.explain?.fallbackUsed).toBe(true);
    expect(discovery.diagnostics.some((d) => d.code === "REACT_ROUTER_NOT_DETECTED")).toBe(true);
  });

  it("does not use fallback when static routes are discovered", async () => {
    const context = adapterContext("react/jsx-routes", "react");
    const discovery = await reactAdapter.discoverRoutes(context);

    expect(discovery.routes.length).toBeGreaterThan(1);
    expect(discovery.routes.some((route) => route.origin === "adapter-default")).toBe(false);
    expect(discovery.explain?.fallbackUsed).toBe(false);
  });

  it("does not use fallback when only dynamic patterns are discovered", async () => {
    const context = adapterContext("react/dynamic-route", "react");
    const discovery = await reactAdapter.discoverRoutes(context);

    expect(discovery.routes.map((route) => route.path)).toEqual(["/"]);
    expect(discovery.skippedPatterns.length).toBe(2);
    expect(discovery.explain?.fallbackUsed).toBe(false);
  });

  it("skips discovery when explicit routes are configured", async () => {
    const context = adapterContext("react/jsx-routes", "react", {
      routes: [{ id: "home", name: "Home", path: "/" }],
    });
    const discovery = await reactAdapter.discoverRoutes(context);
    expect(discovery.routes).toEqual([]);
  });
});

describe("resolveProjectRoutes react merge", () => {
  it("dedupes explicit and discovered routes with the same path", () => {
    const discovery = discover("jsx-routes");
    const result = resolveProjectRoutes({
      explicitRoutes: [{ id: "home", name: "Home", path: "/" }],
      mode: "merge",
      discovery,
    });

    expect(result.routes.filter((route) => route.path === "/")).toHaveLength(1);
    expect(result.routes.map((route) => route.path).sort()).toEqual([
      "/",
      "/about",
      "/contact",
    ]);
  });

  it("feeds audit planning with all resolved static routes", () => {
    const discovery = discover("comprehensive");
    const resolved = resolveProjectRoutes({
      explicitRoutes: [],
      mode: "merge",
      discovery,
    });

    expect(resolved.routes.map((route) => route.path).sort()).toEqual([
      "/",
      "/about",
      "/contact",
      "/projects",
      "/projects/featured",
    ]);

    const config = validateConfig(
      {
        projects: [
          {
            name: "react-web",
            platform: "web",
            framework: "react",
            rootDir: ".",
            baseUrl: "http://localhost:3000",
            routes: resolved.routes,
            routeDiscovery: { mode: "merge" },
            profiles: ["default"],
            viewports: [{ name: "desktop", width: 1280, height: 720 }],
          },
        ],
      },
      { configDir: adapterFixture("react/comprehensive") },
    );

    const plan = createAuditPlan(config);

    expect(plan.totalRuns).toBe(5);
    expect(plan.runs.map((run) => run.route?.path).sort()).toEqual([
      "/",
      "/about",
      "/contact",
      "/projects",
      "/projects/featured",
    ]);
  });
});
