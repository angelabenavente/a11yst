import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_OUTPUT_DIR, DEFAULT_ROOT_DIR, validateConfig } from "@a11yst/config";

describe("@a11yst/config Phase 2 advanced features", () => {
  it("defaults outputDir to .a11yst/results", () => {
    const resolved = validateConfig({
      projects: [
        { name: "website", platform: "web", baseUrl: "http://localhost:3000", routes: ["/"] },
      ],
    });
    expect(resolved.outputDir).toBe(".a11yst/results");
    expect(resolved.outputDir).toBe(DEFAULT_OUTPUT_DIR);
  });

  it("honors an explicit outputDir override", () => {
    const resolved = validateConfig({
      outputDir: "artifacts/a11yst",
      projects: [
        { name: "website", platform: "web", baseUrl: "http://localhost:3000", routes: ["/"] },
      ],
    });
    expect(resolved.outputDir).toBe("artifacts/a11yst");
  });

  it("defaults rootDir to '.' for web projects", () => {
    const resolved = validateConfig({
      projects: [
        { name: "website", platform: "web", baseUrl: "http://localhost:3000", routes: ["/"] },
      ],
    });
    expect(resolved.projects[0]?.rootDir).toBe(".");
    expect(resolved.projects[0]?.rootDir).toBe(DEFAULT_ROOT_DIR);
  });

  it("honors an explicit rootDir override", () => {
    const resolved = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          rootDir: "apps/web",
          baseUrl: "http://localhost:3000",
          routes: ["/"],
        },
      ],
    });
    expect(resolved.projects[0]?.rootDir).toBe("apps/web");
  });

  it("resolves baseUrl from devServer.url alone when baseUrl is omitted", () => {
    const resolved = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          routes: ["/"],
          devServer: { url: "http://localhost:5173" },
        },
      ],
    });
    const project = resolved.projects[0];
    expect(project?.platform).toBe("web");
    if (project?.platform !== "web") return;
    expect(project.baseUrl).toBe("http://localhost:5173");
    expect(project.devServer?.url).toBe("http://localhost:5173");
  });

  it("still throws when neither baseUrl nor devServer.url is provided (Phase 1 regression)", () => {
    expect(() =>
      validateConfig({
        projects: [{ name: "website", platform: "web", routes: ["/"] }],
      }),
    ).toThrow(ConfigError);
  });

  it("accepts baseUrl and a matching devServer.url with no diagnostics", () => {
    const resolved = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          baseUrl: "http://localhost:3000",
          routes: ["/"],
          devServer: { url: "http://localhost:3000" },
        },
      ],
    });
    expect(resolved.projects[0]).toMatchObject({ baseUrl: "http://localhost:3000" });
    expect(
      resolved.diagnostics.some((d) => d.code === "BASE_URL_DEV_SERVER_MISMATCH"),
    ).toBe(false);
  });

  it("reports BASE_URL_DEV_SERVER_MISMATCH and uses baseUrl for planning when they differ", () => {
    const resolved = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          baseUrl: "http://localhost:3000",
          routes: ["/"],
          devServer: { url: "http://localhost:5173" },
        },
      ],
    });
    const project = resolved.projects[0];
    expect(project?.platform).toBe("web");
    if (project?.platform !== "web") return;

    // baseUrl is the source of truth for planning, even though devServer.url differs.
    expect(project.baseUrl).toBe("http://localhost:3000");
    expect(project.devServer?.url).toBe("http://localhost:5173");
    expect(
      resolved.diagnostics.some((d) => d.code === "BASE_URL_DEV_SERVER_MISMATCH"),
    ).toBe(true);
  });

  it("rejects react-native projects", () => {
    expect(() =>
      validateConfig({
        projects: [
          {
            name: "mobile",
            platform: "react-native",
            devServer: { command: "expo start" },
          },
        ],
      }),
    ).toThrow(ConfigError);
  });

  it("still validates old Phase 1 configs without outputDir, rootDir, or devServer", () => {
    const resolved = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          framework: "html",
          baseUrl: "http://localhost:3000",
          routes: ["/", "/about"],
          profiles: ["default"],
          viewports: [{ name: "desktop", width: 1440, height: 900 }],
        },
      ],
    });
    expect(resolved.outputDir).toBe(".a11yst/results");
    expect(resolved.projects[0]?.rootDir).toBe(".");
    const project = resolved.projects[0];
    expect(project?.platform).toBe("web");
    if (project?.platform === "web") {
      expect(project.devServer).toBeUndefined();
    }
  });
});
