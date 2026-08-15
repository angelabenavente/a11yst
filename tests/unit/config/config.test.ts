import { describe, expect, it } from "vitest";
import {
  defineConfig,
  normalizeRoutePath,
  validateConfig,
  ConfigError,
  CONFIG_FILENAMES,
  findConfigPath,
} from "@a11yst/config";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("@a11yst/config validation", () => {
  it("accepts a minimal valid web config and applies defaults", () => {
    const resolved = validateConfig(
      defineConfig({
        projects: [
          {
            name: "website",
            platform: "web",
            baseUrl: "http://localhost:3000",
            routes: ["/"],
          },
        ],
      }),
    );

    const project = resolved.projects[0];
    expect(project?.platform).toBe("web");
    if (project?.platform !== "web") return;
    expect(project.framework).toBe("unknown");
    expect(project.rootDir).toBe(".");
    expect(project.profiles).toEqual(["default"]);
    expect(project.viewports).toEqual([
      {
        name: "desktop",
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        orientation: "landscape",
      },
    ]);
    expect(project.routes[0]).toEqual({ id: "root", name: "Home", path: "/" });
    expect(resolved.evidence).toEqual({ screenshots: true, fullPage: false });
  });

  it("accepts react, next, angular, vue, and nuxt web frameworks", () => {
    for (const framework of ["react", "next", "angular", "vue", "nuxt"] as const) {
      const resolved = validateConfig({
        projects: [
          {
            name: framework,
            platform: "web",
            framework,
            baseUrl: "http://localhost:3000/",
            routes: ["home"],
          },
        ],
      });
      const project = resolved.projects[0];
      expect(project?.platform).toBe("web");
      if (project?.platform !== "web") continue;
      expect(project.framework).toBe(framework);
      expect(project.baseUrl).toBe("http://localhost:3000");
      expect(project.routes[0]?.path).toBe("/home");
    }
  });

  it("rejects react-native and expo as public config platforms", () => {
    expect(() =>
      validateConfig({
        projects: [
          {
            name: "mobile-app",
            platform: "react-native",
            profiles: ["default"],
          },
        ],
      }),
    ).toThrow(ConfigError);

    expect(() =>
      validateConfig({
        projects: [
          {
            name: "expo-app",
            platform: "react-native",
            framework: "expo",
          },
        ],
      }),
    ).toThrow(ConfigError);
  });

  it("rejects web configs without baseUrl", () => {
    expect(() =>
      validateConfig({
        projects: [
          {
            name: "website",
            platform: "web",
            routes: ["/"],
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
            routes: ["/"],
          },
        ],
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const formatted = (error as ConfigError).format();
      expect(formatted).toContain("baseUrl");
      expect(formatted.toLowerCase()).toMatch(/hint|require/);
    }
  });

  it("rejects invalid web routes", () => {
    expect(() =>
      validateConfig({
        projects: [
          {
            name: "website",
            platform: "web",
            baseUrl: "http://localhost:3000",
            routes: ["https://example.com/path"],
          },
        ],
      }),
    ).toThrow(/path|URL|Route/i);
  });

  it("rejects invalid viewport dimensions", () => {
    expect(() =>
      validateConfig({
        projects: [
          {
            name: "website",
            platform: "web",
            baseUrl: "http://localhost:3000",
            routes: ["/"],
            viewports: [{ name: "broken", width: 0, height: 900 }],
          },
        ],
      }),
    ).toThrow(ConfigError);
  });

  it("rejects react-native projects even when they include web fields", () => {
    expect(() =>
      validateConfig({
        projects: [
          {
            name: "mobile-app",
            platform: "react-native",
            framework: "expo",
            baseUrl: "http://localhost:3000",
            routes: ["/"],
            viewports: [{ name: "desktop", width: 1440, height: 900 }],
          },
        ],
      }),
    ).toThrow(ConfigError);
  });

  it("normalises routes with a leading slash", () => {
    expect(normalizeRoutePath("about")).toBe("/about");
    expect(normalizeRoutePath("/about")).toBe("/about");
    expect(normalizeRoutePath("//about")).toBe("/about");
  });

  it("produces understandable error messages", () => {
    try {
      validateConfig({ projects: [] });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const formatted = (error as ConfigError).format();
      expect(formatted).toContain("a11yst");
      expect(formatted.length).toBeGreaterThan(20);
    }
  });

  it("uses only canonical a11yst.config filenames for discovery", () => {
    expect(CONFIG_FILENAMES).toEqual([
      "a11yst.config.ts",
      "a11yst.config.mts",
      "a11yst.config.js",
      "a11yst.config.mjs",
    ]);
    expect(CONFIG_FILENAMES.some((filename) => filename.includes("allyst"))).toBe(false);
  });

  it("does not discover legacy allyst.config filenames", async () => {
    const dir = await mkdtemp(join(tmpdir(), "a11yst-config-legacy-"));
    await writeFile(
      join(dir, "allyst.config.ts"),
      `export default { projects: [{ name: "legacy", platform: "web", baseUrl: "http://localhost:3000", routes: ["/"] }] };`,
      "utf8",
    );

    expect(findConfigPath(dir)).toBeNull();
  });
});
