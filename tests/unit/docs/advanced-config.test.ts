import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const advancedConfigDir = resolve(repoRoot, "tests/fixtures/docs/advanced-config");

describe("advanced configuration fixture", () => {
  it("loads and resolves documented defaults", async () => {
    const config = await loadConfig({ cwd: advancedConfigDir });

    expect(config.outputDir).toBe(".a11yst/results");
    expect(config.sourceAnalysis).toEqual({
      enabled: true,
      ranking: true,
      recommendations: true,
    });
    expect(config.reports.html).toBe(true);
    expect(config.reports.sarif).toBe(true);
    expect(config.reports.junit).toBe(false);
    expect(config.ci.failOnNew).toBe(true);
    expect(config.ci.minimumSeverity).toBe("high");
    expect(config.baseline.file).toBe(".a11yst/baseline.json");
    expect(config.baseline.compare).toBe(true);

    expect(config.projects).toHaveLength(1);
    const project = config.projects[0];
    if (!project || project.platform !== "web") {
      throw new Error("expected web project");
    }

    expect(project.profiles).toEqual(["default", "keyboard", "large-text"]);
    expect(project.viewports).toHaveLength(2);
    expect(project.flows).toHaveLength(1);
    expect(project.flows?.[0]?.steps.some((step) => step.action === "checkpoint")).toBe(true);
  });
});
