import { cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createDemoSummary } from "../../../examples/demo/a11yst-shop/scripts/presentation/index.mjs";
import { repoRoot, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const DEMO_SOURCE = join(repoRoot, "examples/demo/a11yst-shop");
const SECRET_13E = "ALLY_DEMO_INTERNAL_SECRET_13E";
const SECRET_13F = "ALLY_DEMO_SECRET_13F";
const TEST_TIMEOUT_MS = 720_000;

async function copyDemoWorkspace(target: string): Promise<void> {
  await cp(DEMO_SOURCE, target, {
    recursive: true,
    filter: (source) => !source.includes(`${join("a11yst-shop", ".a11yst")}`),
  });
}

async function readLatestResults(cwd: string) {
  const latest = JSON.parse(
    await readFile(join(cwd, ".a11yst/results/latest.json"), "utf8"),
  ) as { resultsPath: string };
  const resultsPath = join(cwd, ".a11yst/results", latest.resultsPath);
  const runDir = join(resultsPath, "..");
  const results = JSON.parse(await readFile(resultsPath, "utf8"));
  return { runDir, results };
}

describe("a11yst-shop demo presentation integration", () => {
  it(
    "runs demo full and produces a summary consistent with stored results",
    async () => {
      await withTempDir("a11yst-shop-presentation-", async (workspace) => {
        await copyDemoWorkspace(workspace);
        await writeFile(join(workspace, "outside-output-sentinel.txt"), "keep", "utf8");
        const port = await getFreePort();
        const env = {
          PORT: String(port),
          A11YST_DEMO_SECRET_13F: SECRET_13F,
          A11YST_CLI_BIN: join(repoRoot, "packages/cli/dist/bin.js"),
        };

        const demo = spawnSync(process.execPath, [join(workspace, "scripts/demo.mjs"), "full"], {
          cwd: workspace,
          env: { ...process.env, ...env, NO_COLOR: "1" },
          encoding: "utf8",
          shell: false,
        });

        expect(demo.status).toBe(0);
        expect(demo.stdout).toContain("a11yst DEMO");
        expect(demo.stdout).toContain("Known findings:");
        expect(demo.stdout).toContain("New findings:");
        expect(demo.stdout).toContain("Interactive findings:");
        expect(demo.stdout).toContain("Configured policy breach:");
        expect(demo.stdout).toContain("Demo complete.");
        expect(demo.stdout).toMatch(/Current audit exit:\s+2/);
        expect(demo.stdout.includes("\u001b[")).toBe(false);

        const { runDir, results } = await readLatestResults(workspace);
        const expected = createDemoSummary(results, 2);
        expect(demo.stdout).toContain(`Known findings:${" ".repeat(7)}${expected.findings.known}`);
        expect(demo.stdout).toContain(`New findings:${" ".repeat(9)}${expected.findings.new}`);
        expect(demo.stdout).toContain(
          `Interactive findings:${" ".repeat(1)}${expected.findings.interactive}`,
        );
        expect(demo.stdout).toContain(`Mapped:${" ".repeat(15)}${expected.sourceAnalysis.mapped}`);
        expect(demo.stdout).toContain(
          `Findings with recommendations:${" ".repeat(1)}${expected.recommendations.findingsWithRecommendations}`,
        );

        const summaryPath = join(workspace, ".a11yst/demo/demo-summary.md");
        const summaryMarkdown = await readFile(summaryPath, "utf8");
        expect(summaryMarkdown).toContain(`| Known | ${expected.findings.known} |`);
        expect(summaryMarkdown).toContain(`| New | ${expected.findings.new} |`);
        expect(summaryMarkdown).toContain(
          `Flow/checkpoint findings: ${expected.findings.interactive}`,
        );
        expect(summaryMarkdown).toContain(
          "Automated accessibility testing does not establish WCAG conformance",
        );
        expect(summaryMarkdown).not.toContain(SECRET_13E);
        expect(summaryMarkdown).not.toContain(SECRET_13F);
        expect(summaryMarkdown).not.toMatch(/\/Users\//);
        expect(summaryMarkdown).not.toMatch(/\/private\/tmp\//);
        expect(summaryMarkdown.toLowerCase()).not.toContain("<img");

        const html = join(runDir, results.artifacts?.reportPath ?? "report/index.html");
        const json = join(runDir, results.artifacts?.resultsPath ?? "results.json");
        expect((await readFile(html, "utf8")).length).toBeGreaterThan(0);
        expect((await readFile(json, "utf8")).length).toBeGreaterThan(0);
        if (results.artifacts?.sarifPath) {
          expect((await readFile(join(runDir, results.artifacts.sarifPath), "utf8")).length).toBeGreaterThan(0);
        }

        expect(await readFile(join(workspace, "outside-output-sentinel.txt"), "utf8")).toBe("keep");

        const clean = spawnSync(process.execPath, [join(workspace, "scripts/demo.mjs"), "clean"], {
          cwd: workspace,
          env: { ...process.env, NO_COLOR: "1" },
          encoding: "utf8",
          shell: false,
        });
        expect(clean.status).toBe(0);
        await expect(readFile(summaryPath, "utf8")).rejects.toThrow();
        expect(await readFile(join(workspace, "outside-output-sentinel.txt"), "utf8")).toBe("keep");
      });
    },
    TEST_TIMEOUT_MS,
  );
});
