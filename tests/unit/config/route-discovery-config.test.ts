import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DEFAULT_READINESS,
  DEFAULT_ROUTE_DISCOVERY,
  validateConfig,
} from "@a11yst/config";

function resolveWeb(overrides: Record<string, unknown> = {}) {
  const config = validateConfig({
    projects: [
      {
        name: "website",
        platform: "web",
        baseUrl: "http://localhost:3000",
        routes: ["/"],
        ...overrides,
      },
    ],
  });
  const project = config.projects[0];
  if (project?.platform !== "web") {
    throw new Error("Expected a resolved web project.");
  }
  return { config, project };
}

describe("Phase 5 route discovery config", () => {
  it("defaults routeDiscovery mode to fallback with empty filters", () => {
    const { project } = resolveWeb({ routes: ["/"], routeDiscovery: undefined });

    expect(project.routeDiscovery).toEqual(DEFAULT_ROUTE_DISCOVERY);
    expect(project.routeDiscovery.mode).toBe("fallback");
    expect(project.routeDiscovery.include).toEqual([]);
    expect(project.routeDiscovery.exclude).toEqual([]);
    expect(project.routeDiscovery.samples).toEqual({});
  });

  it('requires routes when routeDiscovery.mode is "off"', () => {
    expect(() =>
      validateConfig({
        projects: [
          {
            name: "website",
            platform: "web",
            baseUrl: "http://localhost:3000",
            routeDiscovery: { mode: "off" },
          },
        ],
      }),
    ).toThrow(ConfigError);

    try {
      validateConfig({
        projects: [
          {
            name: "website",
            platform: "web",
            baseUrl: "http://localhost:3000",
            routeDiscovery: { mode: "off" },
          },
        ],
      });
      expect.unreachable("Expected validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).format()).toMatch(
        /at least one route.*routeDiscovery\.mode is "off"/i,
      );
    }
  });

  it("allows empty routes at validation when discovery mode is fallback", () => {
    const { project } = resolveWeb({
      routes: [],
      routeDiscovery: { mode: "fallback" },
    });

    expect(project.routes).toEqual([]);
    expect(project.routeDiscovery.mode).toBe("fallback");
  });

  it("allows omitted routes when discovery mode defaults to fallback", () => {
    const { project } = resolveWeb({
      routes: undefined,
    });

    expect(project.routes).toEqual([]);
    expect(project.routeDiscovery.mode).toBe("fallback");
  });

  it("allows empty routes when discovery mode is merge", () => {
    const { project } = resolveWeb({
      routes: [],
      routeDiscovery: { mode: "merge" },
    });

    expect(project.routes).toEqual([]);
    expect(project.routeDiscovery.mode).toBe("merge");
  });

  it("accepts explicit routes when discovery mode is off", () => {
    const { project } = resolveWeb({
      routes: ["/about"],
      routeDiscovery: { mode: "off" },
    });

    expect(project.routeDiscovery.mode).toBe("off");
    expect(project.routes).toEqual([
      { id: "about", name: "About", path: "/about" },
    ]);
  });
});

describe("Phase 5 readiness config", () => {
  it("defaults readiness waitUntil to domcontentloaded", () => {
    const { project } = resolveWeb({ readiness: undefined });

    expect(project.readiness).toEqual(DEFAULT_READINESS);
    expect(project.readiness.waitUntil).toBe("domcontentloaded");
  });

  it("applies readiness overrides", () => {
    const { project } = resolveWeb({
      readiness: {
        waitUntil: "load",
        selector: "#app",
        timeout: 15_000,
        settleFrames: 2,
      },
    });

    expect(project.readiness).toEqual({
      waitUntil: "load",
      selector: "#app",
      timeout: 15_000,
      settleFrames: 2,
    });
  });

  it("rejects invalid readiness values", () => {
    for (const readiness of [
      { waitUntil: "networkidle" },
      { selector: "" },
      { timeout: 0 },
      { settleFrames: -1 },
    ]) {
      expect(() => resolveWeb({ readiness })).toThrow(ConfigError);
    }
  });
});

describe("Phase 5 route discovery samples validation", () => {
  it("requires non-empty sample pattern keys and paths", () => {
    for (const routeDiscovery of [
      { samples: { "": ["/users/1"] } },
      { samples: { "/users/[id]": [""] } },
      { samples: { "/users/[id]": [] } },
    ]) {
      expect(() => resolveWeb({ routeDiscovery })).toThrow(ConfigError);
    }
  });

  it("rejects path traversal in sample paths", () => {
    for (const samplePath of ["../secret", "/users/../admin", "..\\secret"]) {
      expect(() =>
        resolveWeb({
          routeDiscovery: {
            samples: {
              "/users/[id]": [samplePath],
            },
          },
        }),
      ).toThrow(ConfigError);
    }
  });

  it("accepts valid sample paths", () => {
    const { project } = resolveWeb({
      routeDiscovery: {
        samples: {
          "/users/[id]": ["/users/1", "/users/admin"],
          "/posts/[slug]": ["/posts/hello-world"],
        },
      },
    });

    expect(project.routeDiscovery.samples).toEqual({
      "/users/[id]": ["/users/1", "/users/admin"],
      "/posts/[slug]": ["/posts/hello-world"],
    });
  });
});

describe("Phase 5 adapterId resolution", () => {
  it("maps known frameworks to adapter ids and defaults others to generic-web", () => {
    const cases = [
      ["html", "html"],
      ["react", "react"],
      ["next", "next"],
      ["angular", "angular"],
      ["vue", "vue"],
      ["nuxt", "nuxt"],
      ["svelte", "generic-web"],
      ["unknown", "generic-web"],
    ] as const;

    for (const [framework, adapterId] of cases) {
      const { project } = resolveWeb({ framework, routes: ["/"] });
      expect(project.adapterId).toBe(adapterId);
    }
  });
});
