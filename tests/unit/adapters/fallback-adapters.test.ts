import { describe, expect, it } from "vitest";
import {
  angularAdapter,
  reactAdapter,
  vueAdapter,
  readAngularJson,
  resolveAngularSourceRoot,
} from "@a11yst/adapters";
import { adapterContext, adapterFixture } from "../../helpers/adapters.js";

describe("explicit-route fallback adapters", () => {
  it("react adapter returns / fallback when no router is present", async () => {
    const context = adapterContext("react/no-router", "react");
    const discovery = await reactAdapter.discoverRoutes(context);

    expect(discovery.routes).toEqual([
      expect.objectContaining({ path: "/", origin: "adapter-default" }),
    ]);
    expect(discovery.explain?.fallbackUsed).toBe(true);
  });

  it("vue adapter returns / fallback with diagnostic", async () => {
    const context = adapterContext("html", "vue");
    const discovery = await vueAdapter.discoverRoutes(context);

    expect(discovery.routes[0]?.path).toBe("/");
    expect(discovery.diagnostics?.[0]?.code).toBe("VUE_ROUTES_EXPLICIT_RECOMMENDED");
  });

  it("angular adapter reads angular.json and falls back to /", async () => {
    const root = adapterFixture("angular");
    const angularJson = readAngularJson(root);
    expect(angularJson?.defaultProject).toBe("demo");
    expect(resolveAngularSourceRoot(root)).toBe("src");

    const context = adapterContext("angular", "angular");
    const discovery = await angularAdapter.discoverRoutes(context);
    expect(discovery.routes[0]?.path).toBe("/");
    expect(discovery.diagnostics?.[0]?.code).toBe("ANGULAR_ROUTES_EXPLICIT_RECOMMENDED");

    const diagnostics = await angularAdapter.getDiagnostics(context);
    expect(diagnostics.some((d) => d.code === "ANGULAR_SOURCE_ROOT")).toBe(true);
  });

  it("skips fallback when explicit routes are configured on the project", async () => {
    const context = adapterContext("react/no-router", "react", {
      routes: [{ id: "home", name: "Home", path: "/" }],
    });
    const discovery = await reactAdapter.discoverRoutes(context);
    expect(discovery.routes).toEqual([]);
    expect(discovery.diagnostics ?? []).toHaveLength(0);
  });
});
