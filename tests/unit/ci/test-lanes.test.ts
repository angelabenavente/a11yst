import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const rootConfig = readFileSync(join(repoRoot, "vitest.config.ts"), "utf8");
const integrationConfig = readFileSync(
  join(repoRoot, "vitest.integration.config.ts"),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("Vitest execution lanes", () => {
  it("runs unit files with parallelism enabled", () => {
    expect(rootConfig).toContain('name: "unit"');
    expect(rootConfig).toContain('include: ["tests/unit/**/*.test.ts"]');
    expect(rootConfig).toMatch(/name: "unit"[\s\S]*?fileParallelism: true/);
    expect(packageJson.scripts["test:unit"]).toContain("--config vitest.config.ts");
  });

  it("isolates integration files in a single-worker configuration", () => {
    expect(integrationConfig).toContain('name: "integration"');
    expect(integrationConfig).toContain('include: ["tests/integration/**/*.test.ts"]');
    expect(integrationConfig).toMatch(
      /name: "integration"[\s\S]*?fileParallelism: false/,
    );
    expect(integrationConfig).toMatch(/name: "integration"[\s\S]*?maxWorkers: 1/);
    expect(packageJson.scripts["test:integration"]).toContain(
      "--config vitest.integration.config.ts",
    );
    expect(packageJson.scripts["ci:integration"]).toContain(
      "--config vitest.integration.config.ts",
    );
  });

  it("runs the complete suite as two explicit lanes", () => {
    expect(packageJson.scripts.test).toBe("pnpm test:unit && pnpm test:integration");
  });
});
