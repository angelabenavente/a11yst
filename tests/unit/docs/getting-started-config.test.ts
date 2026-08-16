import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const gettingStartedExampleDir = resolve(
  repoRoot,
  "examples/audit/html-accessible",
);

describe("Getting Started documented config", () => {
  it("loads and validates the html-accessible example configuration", async () => {
    const config = await loadConfig({ cwd: gettingStartedExampleDir });

    expect(config.outputDir).toBe(".a11yst/results");
    expect(config.projects).toHaveLength(1);

    const project = config.projects[0];
    if (!project || project.platform !== "web") {
      throw new Error("expected a web project in html-accessible config");
    }
    expect(project.framework).toBe("html");
    expect(project.profiles).toEqual(["default"]);
    expect(project.viewports).toHaveLength(1);
    expect(project.viewports[0]?.name).toBe("desktop");
  });
});
