import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "@a11yst/config";

describe("loadConfig with defineConfig import", () => {
  const previousStage = process.env.A11YST_DEMO_STAGE;

  afterEach(() => {
    if (previousStage === undefined) {
      delete process.env.A11YST_DEMO_STAGE;
    } else {
      process.env.A11YST_DEMO_STAGE = previousStage;
    }
  });

  it("re-reads process.env when config imports defineConfig", async () => {
    const dir = await mkdtemp(join(tmpdir(), "a11yst-config-define-env-"));
    await writeFile(
      join(dir, "a11yst.config.ts"),
      `import { defineConfig } from "@a11yst/config";
const stage = process.env.A11YST_DEMO_STAGE === "baseline" ? "baseline" : "current";
export default defineConfig({
  projects: [{
    name: "probe",
    platform: "web",
    baseUrl: "http://127.0.0.1:3000",
    routes: stage === "baseline" ? ["/account"] : ["/account", "/checkout"],
  }],
});`,
      "utf8",
    );

    process.env.A11YST_DEMO_STAGE = "baseline";
    const baseline = await loadConfig({ cwd: dir });
    process.env.A11YST_DEMO_STAGE = "current";
    const current = await loadConfig({ cwd: dir });

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
