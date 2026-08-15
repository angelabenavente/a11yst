import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DEFAULT_EVIDENCE,
  generateRouteId,
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

describe("Phase 4 route normalization", () => {
  it("keeps string routes compatible and generates required metadata", () => {
    const { project } = resolveWeb({ routes: ["/", "account/settings"] });

    expect(project.routes).toEqual([
      { id: "root", name: "Home", path: "/" },
      {
        id: "account-settings",
        name: "Account Settings",
        path: "/account/settings",
      },
    ]);
  });

  it("preserves structured names and accepts explicit portable ids", () => {
    const { project } = resolveWeb({
      routes: [
        { path: "/pricing", name: "Plans" },
        { id: "Auth_Callback-2", path: "/auth/callback" },
      ],
    });

    expect(project.routes).toEqual([
      { id: "pricing", name: "Plans", path: "/pricing" },
      {
        id: "Auth_Callback-2",
        name: "Auth Callback 2",
        path: "/auth/callback",
      },
    ]);
  });

  it("generates deterministic query and hash ids", () => {
    const routes = [
      "/search?q=large+text",
      "/guide/getting-started#keyboard",
      "/?preview=true#main",
    ];
    const { project } = resolveWeb({ routes });

    expect(project.routes.map((route) => route.id)).toEqual([
      "search-query-q-large-text",
      "guide-getting-started-hash-keyboard",
      "root-query-preview-true-hash-main",
    ]);
    expect(generateRouteId("/search?q=large+text")).toBe(
      "search-query-q-large-text",
    );
  });

  it("preserves route input order", () => {
    const { project } = resolveWeb({
      routes: ["/z", { id: "first", path: "/a" }, "/middle"],
    });
    expect(project.routes.map((route) => route.id)).toEqual([
      "z",
      "first",
      "middle",
    ]);
  });

  it("rejects duplicate generated or explicit ids within a project", () => {
    for (const routes of [
      ["/account/settings", "/account-settings"],
      [{ id: "shared", path: "/one" }, { id: "shared", path: "/two" }],
    ]) {
      try {
        resolveWeb({ routes });
        expect.unreachable("Expected duplicate route ids to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).format()).toMatch(
          /duplicate route id|unique within/i,
        );
      }
    }
  });

  it("rejects invalid explicit ids", () => {
    for (const id of ["with space", "with/slash", "..", "équipe"]) {
      expect(() =>
        resolveWeb({ routes: [{ id, path: "/valid" }] }),
      ).toThrow(ConfigError);
    }
  });

  it("rejects absolute URLs and empty paths", () => {
    for (const route of [
      "https://example.com/account",
      "ftp://example.com/file",
      "//example.com/account",
      "   ",
    ]) {
      expect(() => resolveWeb({ routes: [route] })).toThrow(ConfigError);
    }
  });
});

describe("Phase 4 viewport and evidence normalization", () => {
  it("retains old viewport configs and supplies metadata defaults", () => {
    const { config, project } = resolveWeb({
      viewports: [{ name: "legacy", width: 1024, height: 768 }],
    });

    expect(project.viewports).toEqual([
      {
        name: "legacy",
        width: 1024,
        height: 768,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        orientation: "landscape",
      },
    ]);
    expect(config.evidence).toEqual(DEFAULT_EVIDENCE);
  });

  it("infers portrait and preserves explicit viewport metadata", () => {
    const { project } = resolveWeb({
      viewports: [
        { name: "phone", width: 390, height: 844 },
        {
          name: "rotated-tablet",
          width: 900,
          height: 600,
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          orientation: "portrait",
        },
      ],
    });

    expect(project.viewports[0]).toMatchObject({
      orientation: "portrait",
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });
    expect(project.viewports[1]).toMatchObject({
      orientation: "portrait",
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
  });

  it("preserves viewport order", () => {
    const { project } = resolveWeb({
      viewports: [
        { name: "phone", width: 390, height: 844 },
        { name: "desktop", width: 1440, height: 900 },
      ],
    });
    expect(project.viewports.map((viewport) => viewport.name)).toEqual([
      "phone",
      "desktop",
    ]);
  });

  it("rejects invalid scale, booleans, and orientation", () => {
    for (const viewport of [
      { name: "zero", width: 100, height: 100, deviceScaleFactor: 0 },
      { name: "high", width: 100, height: 100, deviceScaleFactor: 11 },
      {
        name: "infinite",
        width: 100,
        height: 100,
        deviceScaleFactor: Number.POSITIVE_INFINITY,
      },
      { name: "boolean", width: 100, height: 100, isMobile: "yes" },
      { name: "angle", width: 100, height: 100, orientation: "square" },
    ]) {
      expect(() => resolveWeb({ viewports: [viewport] })).toThrow(ConfigError);
    }
  });

  it("defaults and overrides evidence settings independently", () => {
    expect(resolveWeb().config.evidence).toEqual({
      screenshots: true,
      fullPage: false,
    });
    expect(
      resolveWeb({ routes: ["/"] }).config.evidence,
    ).toEqual(DEFAULT_EVIDENCE);

    const config = validateConfig({
      evidence: { screenshots: false, fullPage: true },
      projects: [
        {
          name: "website",
          platform: "web",
          baseUrl: "http://localhost:3000",
          routes: ["/"],
        },
      ],
    });
    expect(config.evidence).toEqual({ screenshots: false, fullPage: true });
  });
});
