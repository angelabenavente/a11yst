import { access, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE_EXAMPLES, copyBaselineExample } from "../../helpers/baseline.js";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";
import { validateAgainstOfficialSchema } from "../../unit/sarif/schema-helper.js";

const LEGACY = BASELINE_EXAMPLES.legacyHtml;
const LEGACY_DIR = join(repoRoot, LEGACY);
const TEST_TIMEOUT_MS = 240_000;

async function auditLegacy(args: string[], env?: NodeJS.ProcessEnv) {
  const port = await getFreePort();
  return runCli(["audit", ...args], {
    cwd: LEGACY_DIR,
    env: { PORT: String(port), ...env },
  });
}

describe.sequential("audit SARIF integration", () => {
  it("does not create SARIF by default", async () => {
    const result = await auditLegacy(["--json", "--no-html"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts?: { sarifPath?: string; manifestPath?: string };
      reports?: { sarif?: unknown };
    };
    expect(payload.artifacts?.sarifPath).toBeUndefined();
    expect(payload.reports?.sarif).toBeUndefined();
    const manifest = JSON.parse(
      await readFile(payload.artifacts!.manifestPath as string, "utf8"),
    );
    expect(manifest.reports?.sarif).toBeUndefined();
  }, TEST_TIMEOUT_MS);

  it("generates bundle SARIF with --sarif", async () => {
    const result = await auditLegacy(["--json", "--no-html", "--sarif"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { sarifPath: string; manifestPath: string; outputDirectory: string };
      reports: { sarif: { path: string; version: string; results: number } };
    };
    expect(payload.reports.sarif.path).toBe("reports/a11yst.sarif");
    expect(payload.reports.sarif.version).toBe("2.1.0");
    await access(payload.artifacts.sarifPath);
    const sarif = JSON.parse(await readFile(payload.artifacts.sarifPath, "utf8"));
    validateAgainstOfficialSchema(sarif);
    const manifest = JSON.parse(await readFile(payload.artifacts.manifestPath, "utf8"));
    expect(manifest.reports.sarif.path).toBe("reports/a11yst.sarif");
  }, TEST_TIMEOUT_MS);

  it("writes identical custom and bundle SARIF copies", async () => {
    await withTempDir("a11yst-sarif-output-", async (root) => {
      const customPath = join(root, "output with spaces", "a11yst.sarif");
      const result = await auditLegacy([
        "--json",
        "--no-html",
        "--sarif",
        "--sarif-output",
        customPath,
      ]);
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        artifacts: { sarifPath: string };
      };
      const bundleContents = await readFile(payload.artifacts.sarifPath, "utf8");
      const customContents = await readFile(customPath, "utf8");
      expect(bundleContents).toBe(customContents);
      validateAgainstOfficialSchema(JSON.parse(bundleContents));
    });
  }, TEST_TIMEOUT_MS);

  it("still generates SARIF when CI policy fails with exit code 2", async () => {
    const result = await auditLegacy(["--json", "--no-html", "--sarif", "--fail-on-new"]);
    expect(result.code).toBe(2);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { sarifPath: string };
      policyEvaluation: { status: string };
    };
    expect(payload.policyEvaluation.status).toBe("failed");
    await access(payload.artifacts.sarifPath);
    validateAgainstOfficialSchema(JSON.parse(await readFile(payload.artifacts.sarifPath, "utf8")));
  }, TEST_TIMEOUT_MS);

  it("does not generate SARIF for operational baseline errors", async () => {
    await withTempDir("a11yst-sarif-op-error-", async (workspace) => {
      await copyBaselineExample(LEGACY, workspace);
      await rm(join(workspace, "a11yst.config.ts"), { force: true });
      const port = await getFreePort();
      const result = await runCli(
        ["audit", "--json", "--sarif", "--baseline", ".a11yst/missing-baseline.json"],
        { cwd: workspace, env: { PORT: String(port) } },
      );
      expect(result.code).toBe(1);
      expect(result.stdout).not.toContain('"sarifPath"');
    });
  }, TEST_TIMEOUT_MS);
});

describe("report SARIF integration", () => {
  it("generates SARIF from persisted results without running audit", async () => {
    await withTempDir("a11yst-report-sarif-", async (root) => {
      const audit = await auditLegacy(["--json", "--no-html", "--sarif", "--output", join(root, "out")]);
      expect(audit.code).toBe(0);
      const payload = JSON.parse(audit.stdout) as { artifacts: { resultsPath: string } };
      const output = join(root, "from-results.sarif");
      const report = await runCli(
        ["report", "--from", payload.artifacts.resultsPath, "--format", "sarif", "--output", output],
        { cwd: LEGACY_DIR },
      );
      expect(report.code).toBe(0);
      expect(report.stderr).toBe("");
      const generated = await readFile(output, "utf8");
      validateAgainstOfficialSchema(JSON.parse(generated));
      const auditSarif = await readFile(
        JSON.parse(audit.stdout).artifacts.sarifPath,
        "utf8",
      );
      expect(generated).toBe(auditSarif);
    });
  }, TEST_TIMEOUT_MS);

  it("accepts legacy results without report metadata", async () => {
    await withTempDir("a11yst-legacy-report-", async (root) => {
      const audit = await auditLegacy(["--json", "--no-html", "--output", join(root, "out")]);
      const payload = JSON.parse(audit.stdout) as { artifacts: { resultsPath: string } };
      const legacy = JSON.parse(await readFile(payload.artifacts.resultsPath, "utf8"));
      delete legacy.policyEvaluation;
      delete legacy.reports;
      delete legacy.baselineSummary;
      const legacyPath = join(root, "legacy-results.json");
      await writeFile(legacyPath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
      const output = join(root, "legacy.sarif");
      const report = await runCli(
        ["report", legacyPath, "--format", "sarif", "--output", output],
        { cwd: LEGACY_DIR },
      );
      expect(report.code).toBe(0);
      validateAgainstOfficialSchema(JSON.parse(await readFile(output, "utf8")));
    });
  }, TEST_TIMEOUT_MS);
});
