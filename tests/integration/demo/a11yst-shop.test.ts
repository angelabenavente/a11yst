import { cp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const DEMO_SOURCE = join(repoRoot, "examples/demo/a11yst-shop");
const SECRET = "ALLY_DEMO_INTERNAL_SECRET_13E";
const TEST_TIMEOUT_MS = 720_000;

type AuditResult = {
  findings: Array<{
    ruleId: string;
    severity: string;
    fingerprint: string;
    route?: string;
    flowId?: string;
    checkpointId?: string;
    baseline?: { status?: string };
    sourceMapping?: {
      status?: string;
      selected?: {
        confidence?: string;
        location?: { uri?: string };
      };
    };
    recommendations?: {
      status?: string;
      recommendations?: Array<{
        actions?: unknown[];
        verification?: unknown[];
        examples?: Array<{ generic?: boolean }>;
      }>;
    };
  }>;
  artifacts?: {
    outputDirectory?: string;
    reportPath?: string;
    sarifPath?: string;
    junitPath?: string;
    markdownPath?: string;
    githubAnnotationsPath?: string;
  };
};

async function copyDemoWorkspace(target: string): Promise<void> {
  await cp(DEMO_SOURCE, target, {
    recursive: true,
    filter: (source) => !source.includes(`${join("a11yst-shop", ".a11yst")}`),
  });
}

async function readLatestResults(cwd: string): Promise<{ runDir: string; results: AuditResult }> {
  const latest = JSON.parse(
    await readFile(join(cwd, ".a11yst/results/latest.json"), "utf8"),
  ) as { resultsPath: string };
  const resultsPath = join(cwd, ".a11yst/results", latest.resultsPath);
  const runDir = join(resultsPath, "..");
  return {
    runDir,
    results: JSON.parse(await readFile(resultsPath, "utf8")) as AuditResult,
  };
}

function assertNoLeaks(text: string, cwd: string) {
  expect(text).not.toContain(SECRET);
  expect(text).not.toContain(cwd);
  expect(text).not.toMatch(/\/Users\//);
  expect(text).not.toMatch(/\/private\/tmp\//);
}

describe("a11yst-shop end-to-end demo", () => {
  it(
    "runs baseline and current stages with real CLI, browser, baseline, source analysis, and policy",
    async () => {
      await withTempDir("a11yst-shop-demo-", async (workspace) => {
        await copyDemoWorkspace(workspace);
        const port = await getFreePort();
        const env = { PORT: String(port) };

        const baselineAudit = await runCli(["audit", "--json"], {
          cwd: workspace,
          env: { ...env, A11YST_DEMO_STAGE: "baseline" },
        });
        expect(baselineAudit.code).toBe(0);
        const baselinePayload = JSON.parse(baselineAudit.stdout) as AuditResult;
        expect(baselinePayload.findings.length).toBeGreaterThan(0);
        expect(baselinePayload.findings.some((finding) => finding.route === "/account")).toBe(
          true,
        );

        const baselineCreate = await runCli(["baseline", "create", "--force"], {
          cwd: workspace,
          env: { ...env, A11YST_DEMO_STAGE: "baseline" },
        });
        expect(baselineCreate.code).toBe(0);
        const baselineFile = JSON.parse(
          await readFile(join(workspace, ".a11yst/baseline.json"), "utf8"),
        ) as { entries: unknown[] };
        expect(baselineFile.entries.length).toBeGreaterThan(0);

        const currentAudit = await runCli(["audit", "--json"], {
          cwd: workspace,
          env: { ...env, A11YST_DEMO_STAGE: "current" },
        });
        expect(currentAudit.code).toBe(2);

        const { runDir, results } = await readLatestResults(workspace);
        const known = results.findings.filter((finding) => finding.baseline?.status === "known");
        const fresh = results.findings.filter((finding) => finding.baseline?.status === "new");
        expect(known.length).toBeGreaterThanOrEqual(1);
        expect(fresh.length).toBeGreaterThanOrEqual(1);

        const checkoutFinding = results.findings.find(
          (finding) =>
            finding.route === "/checkout" &&
            (finding.ruleId === "button-name" || finding.ruleId === "label"),
        );
        expect(checkoutFinding).toBeDefined();

        const interactiveFinding = results.findings.find(
          (finding) =>
            finding.flowId === "checkout-help" &&
            finding.checkpointId === "help-dialog-open" &&
            finding.ruleId === "aria-dialog-name",
        );
        expect(interactiveFinding).toBeDefined();

        const mappedCheckout = results.findings.find(
          (finding) =>
            finding.sourceMapping?.status === "mapped" &&
            finding.sourceMapping.selected?.location?.uri?.includes("site/checkout.html"),
        );
        expect(mappedCheckout).toBeDefined();
        expect(mappedCheckout?.sourceMapping?.selected?.location?.uri).not.toMatch(/^\/Users\//);

        const withRecommendation = results.findings.find(
          (finding) =>
            finding.recommendations?.status === "recommended" ||
            finding.recommendations?.status === "manual-review",
        );
        expect(withRecommendation).toBeDefined();
        const recommendation = withRecommendation?.recommendations?.recommendations?.[0];
        expect(recommendation?.actions?.length).toBeGreaterThan(0);
        expect(recommendation?.verification?.length).toBeGreaterThan(0);

        const artifactsDir = runDir;
        const sarifPath = join(
          artifactsDir,
          results.artifacts?.sarifPath ?? "reports/a11yst.sarif",
        );
        const htmlPath = join(artifactsDir, results.artifacts?.reportPath ?? "report/index.html");
        const markdownPath = join(
          artifactsDir,
          results.artifacts?.markdownPath ?? "reports/a11yst.md",
        );
        const junitPath = join(
          artifactsDir,
          results.artifacts?.junitPath ?? "reports/a11yst.junit.xml",
        );
        const annotationsPath = join(
          artifactsDir,
          results.artifacts?.githubAnnotationsPath ?? "reports/github-annotations.txt",
        );

        const sarif = await readFile(sarifPath, "utf8");
        const html = await readFile(htmlPath, "utf8");
        const markdown = await readFile(markdownPath, "utf8");
        const junit = await readFile(junitPath, "utf8");
        const annotations = await readFile(annotationsPath, "utf8");
        expect(sarif.length).toBeGreaterThan(0);
        expect(html.length).toBeGreaterThan(0);
        expect(markdown.length).toBeGreaterThan(0);
        expect(junit.length).toBeGreaterThan(0);
        expect(annotations.length).toBeGreaterThan(0);
        JSON.parse(sarif);

        const reportRegen = await runCli(
          [
            "report",
            join(
              ".a11yst/results",
              (JSON.parse(await readFile(join(workspace, ".a11yst/results/latest.json"), "utf8")) as {
                resultsPath: string;
              }).resultsPath,
            ),
            "--format",
            "markdown",
            "--output",
            ".a11yst/regenerated",
          ],
          { cwd: workspace, env: { ...env, A11YST_DEMO_STAGE: "current" } },
        );
        expect(reportRegen.code).toBe(0);

        const serialized = JSON.stringify(results);
        assertNoLeaks(serialized, workspace);
        assertNoLeaks(html, workspace);
        assertNoLeaks(sarif, workspace);
        assertNoLeaks(markdown, workspace);
        expect(html.toLowerCase()).not.toContain("intentional accessibility issue for the a11yst demo");

        const baselineAgain = await runCli(["audit", "--json"], {
          cwd: workspace,
          env: { ...env, A11YST_DEMO_STAGE: "current" },
        });
        expect(baselineAgain.code).toBe(2);
        const second = await readLatestResults(workspace);
        expect(second.results.findings.map((finding) => finding.fingerprint).sort()).toEqual(
          results.findings.map((finding) => finding.fingerprint).sort(),
        );

        await rm(join(workspace, ".a11yst"), { recursive: true, force: true });
      });
    },
    TEST_TIMEOUT_MS,
  );
});
