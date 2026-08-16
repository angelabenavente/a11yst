import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "@a11yst/config";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const demoRoot = resolve(repoRoot, "examples/demo/a11yst-shop");

describe("a11yst-shop demo config", () => {
  const previousStage = process.env.A11YST_DEMO_STAGE;

  afterEach(() => {
    if (previousStage === undefined) {
      delete process.env.A11YST_DEMO_STAGE;
    } else {
      process.env.A11YST_DEMO_STAGE = previousStage;
    }
  });

  it("loads baseline stage with account route only and no flow", async () => {
    process.env.A11YST_DEMO_STAGE = "baseline";
    const config = await loadConfig({ cwd: demoRoot });
    const project = config.projects[0];
    if (!project || project.platform !== "web") {
      throw new Error("expected web project");
    }

    expect(project.routes.map((route) => route.path)).toEqual(["/account"]);
    expect(project.flows ?? []).toHaveLength(0);
    expect(project.profiles).toEqual(["default", "keyboard"]);
    expect(project.viewports).toHaveLength(2);
    expect(config.sourceAnalysis.enabled).toBe(true);
    expect(config.sourceAnalysis.recommendations).toBe(true);
    expect(config.reports.sarif).toBe(true);
    expect(config.ci.failOnNew).toBe(false);
  });

  it("loads current stage with checkout route, flow, and policy", async () => {
    process.env.A11YST_DEMO_STAGE = "current";
    const config = await loadConfig({ cwd: demoRoot });
    const project = config.projects[0];
    if (!project || project.platform !== "web") {
      throw new Error("expected web project");
    }

    expect(project.routes.map((route) => route.path)).toEqual(["/account", "/checkout"]);
    expect(project.flows).toHaveLength(1);
    expect(project.flows?.[0]?.id).toBe("checkout-help");
    expect(config.ci.failOnNew).toBe(true);
    expect(config.ci.minimumSeverity).toBe("high");
  });

  it("rejects unknown A11YST_DEMO_STAGE values", async () => {
    process.env.A11YST_DEMO_STAGE = "unexpected";
    await expect(loadConfig({ cwd: demoRoot })).rejects.toSatisfy((error: unknown) => {
      if (error instanceof ConfigError) {
        return error.issues.some((issue) => /Invalid A11YST_DEMO_STAGE/.test(issue.message));
      }
      const message = error instanceof Error ? error.message : String(error);
      return /Invalid A11YST_DEMO_STAGE/.test(message);
    });
  });

  it("re-reads A11YST_DEMO_STAGE on each loadConfig call", async () => {
    process.env.A11YST_DEMO_STAGE = "baseline";
    const baseline = await loadConfig({ cwd: demoRoot });
    process.env.A11YST_DEMO_STAGE = "current";
    const current = await loadConfig({ cwd: demoRoot });

    expect(baseline.projects[0]?.platform).toBe("web");
    if (baseline.projects[0]?.platform !== "web") {
      return;
    }
    expect(baseline.projects[0].routes).toHaveLength(1);
    expect(current.projects[0]?.platform).toBe("web");
    if (current.projects[0]?.platform !== "web") {
      return;
    }
    expect(current.projects[0].routes).toHaveLength(2);
  });
});
