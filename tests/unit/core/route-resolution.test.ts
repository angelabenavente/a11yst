import { describe, expect, it } from "vitest";
import { validateConfig } from "@a11yst/config";
import {
  buildRunId,
  createAuditPlan,
  prepareAuditConfig,
  resolveProjectRoutesForProject,
} from "@a11yst/core";
import { adapterFixture, webProject } from "../../helpers/adapters.js";

describe("resolveProjectRoutesForProject", () => {
  it("uses explicit routes only when discovery mode is off", async () => {
    const project = webProject("html", {
      routes: [{ id: "home", name: "Home", path: "/" }],
      routeDiscovery: { mode: "off", include: [], exclude: [], samples: {} },
    });

    const result = await resolveProjectRoutesForProject(project, adapterFixture("html"));

    expect(result.routes).toEqual([{ id: "home", name: "Home", path: "/" }]);
    expect(result.diagnostics).toEqual([]);
  });

  it("discovers html routes in fallback mode when explicit routes are empty", async () => {
    const project = webProject("html", {
      routeDiscovery: { mode: "fallback", include: [], exclude: [], samples: {} },
    });

    const result = await resolveProjectRoutesForProject(project, adapterFixture("html"));

    expect(result.routes.map((route) => route.path).sort()).toEqual([
      "/",
      "/about.html",
      "/about/",
      "/docs/guide/",
    ]);
    expect(result.routes.every((route) => route.origin === "filesystem")).toBe(true);
  });

  it("ignores discovery in fallback mode when explicit routes exist", async () => {
    const explicit = [{ id: "custom", name: "Custom", path: "/custom" }];
    const project = webProject("html", {
      routes: explicit,
      routeDiscovery: { mode: "fallback", include: [], exclude: [], samples: {} },
    });

    const result = await resolveProjectRoutesForProject(project, adapterFixture("html"));

    expect(result.routes).toEqual(explicit);
    expect(result.diagnostics).toEqual([]);
  });

  it("merges discovered routes in merge mode", async () => {
    const explicit = [{ id: "custom", name: "Custom", path: "/custom" }];
    const project = webProject("html", {
      routes: explicit,
      routeDiscovery: { mode: "merge", include: [], exclude: [], samples: {} },
    });

    const result = await resolveProjectRoutesForProject(project, adapterFixture("html"));

    expect(result.routes.map((route) => route.path)).toEqual([
      "/custom",
      "/",
      "/about.html",
      "/about/",
      "/docs/guide/",
    ]);
  });
});

describe("prepareAuditConfig and createAuditPlan adapter metadata", () => {
  it("adds adapter metadata to planned runs without changing run ids", async () => {
    const config = validateConfig(
      {
        projects: [
          {
            name: "website",
            platform: "web",
            framework: "html",
            baseUrl: "http://localhost:4173",
            routes: [{ id: "home-route", name: "Home", path: "/" }],
            profiles: ["default"],
            viewports: [{ name: "desktop", width: 1440, height: 900 }],
          },
        ],
      },
      { configDir: adapterFixture("html") },
    );

    const prepared = await prepareAuditConfig(config);
    const plan = createAuditPlan(prepared);
    const expectedId = buildRunId({
      projectName: "website",
      platform: "web",
      framework: "html",
      profile: "default",
      routePath: "/",
      viewportName: "desktop",
    });

    expect(plan.runs).toHaveLength(1);
    expect(plan.runs[0]?.id).toBe(expectedId);
    expect(plan.runs[0]?.adapter).toMatchObject({
      adapterId: "html",
      framework: "html",
      supportLevel: "first-class",
      routeOrigin: "explicit",
      readinessStrategy: expect.stringContaining("waitUntil="),
    });
  });

  it("propagates discovered route origins onto planned runs", async () => {
    const config = validateConfig(
      {
        projects: [
          {
            name: "website",
            platform: "web",
            framework: "html",
            baseUrl: "http://localhost:4173",
            routeDiscovery: { mode: "fallback" },
            profiles: ["default"],
            viewports: [{ name: "desktop", width: 1440, height: 900 }],
          },
        ],
      },
      { configDir: adapterFixture("html") },
    );

    const plan = createAuditPlan(await prepareAuditConfig(config));
    const discovered = plan.runs.find((run) => run.route?.path === "/about.html");

    expect(discovered?.adapter).toMatchObject({
      adapterId: "html",
      routeOrigin: "filesystem",
    });
    expect(discovered?.route?.origin).toBe("filesystem");
  });
});
