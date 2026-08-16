import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";
import { createAuditPlan } from "@a11yst/core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("example projects", () => {
  it("loads html-basic and plans 2 runs", async () => {
    const config = await loadConfig({
      cwd: resolve(root, "examples/html-basic"),
    });
    const plan = createAuditPlan(config);

    expect(config.projects).toHaveLength(1);
    expect(config.projects[0]?.platform).toBe("web");
    if (config.projects[0]?.platform === "web") {
      expect(config.projects[0].routes).toHaveLength(2);
      expect(config.projects[0].framework).toBe("html");
    }
    // 2 routes × 1 profile × 1 viewport
    expect(plan.totalRuns).toBe(2);
  });

  it("loads react-basic and plans 8 runs", async () => {
    const config = await loadConfig({
      cwd: resolve(root, "examples/react-basic"),
    });
    const plan = createAuditPlan(config);

    expect(config.projects).toHaveLength(1);
    expect(config.projects[0]?.platform).toBe("web");
    if (config.projects[0]?.platform === "web") {
      expect(config.projects[0].routes).toHaveLength(2);
      expect(config.projects[0].profiles).toEqual(["default", "keyboard"]);
      expect(config.projects[0].viewports).toHaveLength(2);
      expect(config.projects[0].framework).toBe("react");
    }
    // 2 routes × 2 profiles × 2 viewports
    expect(plan.totalRuns).toBe(8);
  });
});
