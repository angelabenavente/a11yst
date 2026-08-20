import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE_EXAMPLES } from "../../helpers/baseline.js";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const LEGACY = BASELINE_EXAMPLES.legacyHtml;
const LEGACY_DIR = join(repoRoot, LEGACY);
const TEST_TIMEOUT_MS = 240_000;

function withoutReportsSection(markdown: string): string {
  return markdown.replace(/\n## Reports[\s\S]*?(?=\n> Automated testing does not establish)/, "\n");
}

function normalizeReportMarkdown(markdown: string): string {
  return withoutReportsSection(markdown)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n(?=> )/g, "\n");
}

async function auditLegacy(args: string[], env?: NodeJS.ProcessEnv) {
  const port = await getFreePort();
  return runCli(["audit", ...args], {
    cwd: LEGACY_DIR,
    env: { PORT: String(port), ...env },
  });
}

describe("report Markdown integration", () => {
  it("generates Markdown from persisted results without running audit", async () => {
    await withTempDir("a11yst-report-markdown-", async (root) => {
      const audit = await auditLegacy([
        "--json",
        "--no-html",
        "--output",
        join(root, "out"),
      ]);
      expect(audit.code).toBe(0);
      const payload = JSON.parse(audit.stdout) as { artifacts: { resultsPath: string } };
      const output = join(root, "from-results.md");
      const report = await runCli(
        [
          "report",
          "--from",
          payload.artifacts.resultsPath,
          "--format",
          "markdown",
          "--output",
          output,
        ],
        { cwd: LEGACY_DIR, env: { PLAYWRIGHT_BROWSERS_PATH: join(root, "browser-must-not-launch") } },
      );
      expect(report.code).toBe(0);
      expect(report.stderr).toBe("");
      const generated = await readFile(output, "utf8");
      expect(generated).toMatch(/^# a11yst Accessibility Report\n/);
      expect(generated.endsWith("\n")).toBe(true);
      const auditMarkdown = await readFile(
        JSON.parse(audit.stdout).artifacts.markdownPath,
        "utf8",
      );
      expect(normalizeReportMarkdown(auditMarkdown)).toBe(normalizeReportMarkdown(generated));
    });
  }, TEST_TIMEOUT_MS);

  it("accepts legacy results without policyEvaluation", async () => {
    await withTempDir("a11yst-legacy-markdown-report-", async (root) => {
      const audit = await auditLegacy(["--json", "--no-html", "--output", join(root, "out")]);
      const payload = JSON.parse(audit.stdout) as { artifacts: { resultsPath: string } };
      const legacy = JSON.parse(await readFile(payload.artifacts.resultsPath, "utf8"));
      delete legacy.policyEvaluation;
      delete legacy.reports;
      delete legacy.baselineSummary;
      const legacyPath = join(root, "legacy-results.json");
      await writeFile(legacyPath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
      const output = join(root, "legacy.md");
      const report = await runCli(
        ["report", legacyPath, "--format", "markdown", "--output", output],
        { cwd: LEGACY_DIR, env: { PLAYWRIGHT_BROWSERS_PATH: join(root, "no-browser") } },
      );
      expect(report.code).toBe(0);
      await access(output);
      const markdown = await readFile(output, "utf8");
      expect(markdown).toContain("## Status");
      expect(markdown).toContain("| CI policy | Not available |");
    });
  }, TEST_TIMEOUT_MS);
});

describe("report GitHub annotations integration", () => {
  it("generates GitHub annotations from persisted results without running audit", async () => {
    await withTempDir("a11yst-report-github-", async (root) => {
      const audit = await auditLegacy([
        "--json",
        "--no-html",
        "--github-annotations",
        "--fail-on-new",
        "--output",
        join(root, "out"),
      ]);
      expect(audit.code).toBe(2);
      const payload = JSON.parse(audit.stdout) as { artifacts: { resultsPath: string } };
      const output = join(root, "from-results-annotations.txt");
      const report = await runCli(
        [
          "report",
          "--from",
          payload.artifacts.resultsPath,
          "--format",
          "github-annotations",
          "--output",
          output,
        ],
        { cwd: LEGACY_DIR, env: { PLAYWRIGHT_BROWSERS_PATH: join(root, "browser-must-not-launch") } },
      );
      expect(report.code).toBe(0);
      expect(report.stderr).toBe("");
      const generated = await readFile(output, "utf8");
      if (generated.length > 0) {
        expect(generated.endsWith("\n")).toBe(true);
        expect(generated).toContain("::error");
      }
      const auditAnnotations = await readFile(
        JSON.parse(audit.stdout).artifacts.githubAnnotationsPath,
        "utf8",
      );
      expect(generated).toBe(auditAnnotations);
    });
  }, TEST_TIMEOUT_MS);

  it("accepts legacy results without policyEvaluation", async () => {
    await withTempDir("a11yst-legacy-github-report-", async (root) => {
      const audit = await auditLegacy(["--json", "--no-html", "--output", join(root, "out")]);
      const payload = JSON.parse(audit.stdout) as { artifacts: { resultsPath: string } };
      const legacy = JSON.parse(await readFile(payload.artifacts.resultsPath, "utf8"));
      delete legacy.policyEvaluation;
      delete legacy.reports;
      delete legacy.baselineSummary;
      const legacyPath = join(root, "legacy-results.json");
      await writeFile(legacyPath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
      const output = join(root, "legacy-annotations.txt");
      const report = await runCli(
        ["report", legacyPath, "--format", "github-annotations", "--output", output],
        { cwd: LEGACY_DIR, env: { PLAYWRIGHT_BROWSERS_PATH: join(root, "no-browser") } },
      );
      expect(report.code).toBe(0);
      await access(output);
      expect(await readFile(output, "utf8")).toBe("");
    });
  }, TEST_TIMEOUT_MS);
});
