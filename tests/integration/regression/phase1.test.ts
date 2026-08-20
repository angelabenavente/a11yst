import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, validateConfig } from "@a11yst/config";
import { buildRunId, createAuditPlan } from "@a11yst/core";
import { productMetadata } from "@a11yst/types";
import { repoRoot } from "../../helpers/cli.js";

describe("Phase 1 regression", () => {
  it("html-basic still plans exactly 2 runs", async () => {
    const config = await loadConfig({ cwd: resolve(repoRoot, "examples/html-basic") });
    const plan = createAuditPlan(config);
    expect(plan.totalRuns).toBe(2);
  });

  it("react-basic still plans exactly 8 runs", async () => {
    const config = await loadConfig({ cwd: resolve(repoRoot, "examples/react-basic") });
    const plan = createAuditPlan(config);
    expect(plan.totalRuns).toBe(8);
  });

  it("createAuditPlan still produces the classic run id for the html-basic fixture shape", () => {
    const config = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          framework: "html",
          baseUrl: "http://localhost:4173",
          routes: ["/"],
          profiles: ["default"],
          viewports: [{ name: "desktop", width: 1440, height: 900 }],
        },
      ],
    });
    const plan = createAuditPlan(config);
    expect(plan.runs[0]?.id).toBe("web::website::html::default::root::desktop");
    expect(plan.runs[0]?.id).toBe(
      buildRunId({
        projectName: "website",
        platform: "web",
        framework: "html",
        profile: "default",
        routePath: "/",
        viewportName: "desktop",
      }),
    );
  });

  it("productMetadata remains centralized in @a11yst/types", () => {
    expect(productMetadata.name).toBe("a11yst");
    expect(productMetadata.command).toBe("a11yst");
    expect(typeof productMetadata.version).toBe("string");
  });

  it("accepts an old-shape config without outputDir, rootDir, or devServer", () => {
    const resolved = validateConfig({
      projects: [
        {
          name: "website",
          platform: "web",
          framework: "react",
          baseUrl: "http://localhost:3000",
          routes: ["/", "/about"],
          profiles: ["default", "keyboard"],
          viewports: [
            { name: "mobile", width: 390, height: 844 },
            { name: "desktop", width: 1440, height: 900 },
          ],
        },
      ],
    });

    expect(resolved.outputDir).toBe(".a11yst/results");
    expect(resolved.projects[0]?.rootDir).toBe(".");

    const plan = createAuditPlan(resolved);
    expect(plan.totalRuns).toBe(8);
  });

  it("still rejects web projects without baseUrl or devServer.url", () => {
    expect(() =>
      validateConfig({
        projects: [{ name: "website", platform: "web", routes: ["/"] }],
      }),
    ).toThrow(ConfigError);

    try {
      validateConfig({
        projects: [{ name: "website", platform: "web", routes: ["/"] }],
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).format()).toMatch(/baseUrl/i);
    }
  });
});
