import { resolve } from "node:path";
import {
  createAdapterContext,
  resolveAdapter,
  resolveProjectRoutes,
} from "@a11yst/adapters";
import { loadConfig } from "@a11yst/config";
import { createAuditPlan } from "@a11yst/core";
import type { AuditPlan, ResolvedConfig, ResolvedWebProject } from "@a11yst/types";
import { describe, expect, it } from "vitest";
import { repoRoot } from "../../helpers/cli.js";

const frameworkExample = (name: string) =>
  resolve(repoRoot, "examples/frameworks", name);

async function planFrameworkExample(name: string): Promise<{
  config: ResolvedConfig;
  plan: AuditPlan;
}> {
  const cwd = frameworkExample(name);
  const config = await loadConfig({ cwd });
  const projects = await Promise.all(
    config.projects.map(async (project) => {
      if (project.platform !== "web") {
        return project;
      }

      const projectRoot = resolve(config.configDir, project.rootDir);
      const adapter = resolveAdapter({
        platform: "web",
        framework: project.framework,
      });
      if (!adapter) {
        return project;
      }

      const context = createAdapterContext(projectRoot, config.configDir, project);
      const discovery = await adapter.discoverRoutes(context);
      const resolved = resolveProjectRoutes({
        explicitRoutes: project.routes,
        mode: project.routeDiscovery.mode,
        samples: project.routeDiscovery.samples,
        discovery,
      });

      const enriched: ResolvedWebProject = {
        ...project,
        routes: resolved.routes,
      };
      return enriched;
    }),
  );

  const plan = createAuditPlan({ ...config, projects });
  return { config, plan };
}

describe("framework example planning", () => {
  it("loads html-site and plans 2 discovered routes", async () => {
    const { config, plan } = await planFrameworkExample("html-site");
    const project = config.projects[0];

    expect(project?.platform).toBe("web");
    if (project?.platform === "web") {
      expect(project.framework).toBe("html");
      expect(project.routes).toHaveLength(0);
    }

    expect(plan.totalRuns).toBe(2);
    expect(plan.runs.map((run) => run.route?.path).sort()).toEqual(["/", "/about/"]);
  });

  it("loads react-vite and plans 2 explicit routes", async () => {
    const { config, plan } = await planFrameworkExample("react-vite");
    const project = config.projects[0];

    expect(project?.platform).toBe("web");
    if (project?.platform === "web") {
      expect(project.framework).toBe("react");
      expect(project.routes.map((route) => route.path)).toEqual(["/", "/issues"]);
    }

    expect(plan.totalRuns).toBe(2);
  });

  it("loads next-app and plans 3 discovered plus sampled routes", async () => {
    const { config, plan } = await planFrameworkExample("next-app");
    const project = config.projects[0];

    expect(project?.platform).toBe("web");
    if (project?.platform === "web") {
      expect(project.framework).toBe("next");
      expect(project.routes).toHaveLength(0);
    }

    expect(plan.totalRuns).toBe(3);
    expect(plan.runs.map((run) => run.route?.path).sort()).toEqual([
      "/",
      "/about",
      "/products/example",
    ]);
  });

  it("loads angular-app and plans 2 explicit routes", async () => {
    const { config, plan } = await planFrameworkExample("angular-app");
    const project = config.projects[0];

    expect(project?.platform).toBe("web");
    if (project?.platform === "web") {
      expect(project.framework).toBe("angular");
      expect(project.routes.map((route) => route.path)).toEqual(["/", "/contact"]);
    }

    expect(plan.totalRuns).toBe(2);
  });

  it("loads vue-vite and plans 2 explicit routes", async () => {
    const { config, plan } = await planFrameworkExample("vue-vite");
    const project = config.projects[0];

    expect(project?.platform).toBe("web");
    if (project?.platform === "web") {
      expect(project.framework).toBe("vue");
      expect(project.routes.map((route) => route.path)).toEqual(["/", "/issues"]);
    }

    expect(plan.totalRuns).toBe(2);
  });

  it("loads nuxt-app and plans 3 discovered plus sampled routes", async () => {
    const { config, plan } = await planFrameworkExample("nuxt-app");
    const project = config.projects[0];

    expect(project?.platform).toBe("web");
    if (project?.platform === "web") {
      expect(project.framework).toBe("nuxt");
      expect(project.routes).toHaveLength(0);
    }

    expect(plan.totalRuns).toBe(3);
    expect(plan.runs.map((run) => run.route?.path).sort()).toEqual([
      "/",
      "/about",
      "/users/example",
    ]);
  });
});
