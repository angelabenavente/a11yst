import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";
import { createAuditPlan } from "@a11yst/core";
import { repoRoot } from "../../helpers/cli.js";

const reportExample = (name: string) => resolve(repoRoot, "examples/report", name);

describe("report example planning", () => {
  it("loads multi-route-html and plans 6 default web runs", async () => {
    const config = await loadConfig({ cwd: reportExample("multi-route-html") });
    const plan = createAuditPlan(config);
    const project = config.projects[0];

    expect(plan.totalRuns).toBe(6);
    expect(plan.runs.every((run) => run.profile === "default")).toBe(true);
    expect(project?.platform).toBe("web");
    if (project?.platform === "web") {
      expect(project.routes.map(({ id, name }) => ({ id, name }))).toEqual([
        { id: "home", name: "Home" },
        { id: "button", name: "Unnamed button" },
        { id: "form", name: "Unlabelled form" },
      ]);
      expect(project.viewports).toEqual([
        {
          name: "mobile",
          width: 390,
          height: 844,
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          orientation: "portrait",
        },
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
    }
  });

  it("loads responsive-react and plans 8 runs with 4 executable defaults", async () => {
    const config = await loadConfig({ cwd: reportExample("responsive-react") });
    const plan = createAuditPlan(config);
    const executable = plan.runs.filter(
      (run) => run.platform === "web" && run.profile === "default",
    );

    expect(plan.totalRuns).toBe(8);
    expect(executable).toHaveLength(4);
    expect(plan.runs.map((run) => run.route?.id)).toEqual([
      "home",
      "home",
      "home",
      "home",
      "issues",
      "issues",
      "issues",
      "issues",
    ]);
  });

  it("loads mixed-workspace and plans one web run", async () => {
    const config = await loadConfig({ cwd: reportExample("mixed-workspace") });
    const plan = createAuditPlan(config);

    expect(plan.totalRuns).toBe(1);
    expect(plan.runs.filter((run) => run.platform === "web")).toHaveLength(1);
    expect(config.projects.map((project) => project.rootDir)).toEqual(["apps/web"]);
  });
});
