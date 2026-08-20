import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateJunitXml } from "../../unit/junit/xml-helper.js";
import { BASELINE_EXAMPLES } from "../../helpers/baseline.js";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

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

describe("report JUnit integration", () => {
  it("generates JUnit from persisted results without running audit", async () => {
    await withTempDir("a11yst-report-junit-", async (root) => {
      const audit = await auditLegacy([
        "--json",
        "--no-html",
        "--junit",
        "--output",
        join(root, "out"),
      ]);
      expect(audit.code).toBe(0);
      const payload = JSON.parse(audit.stdout) as { artifacts: { resultsPath: string } };
      const output = join(root, "from-results.junit.xml");
      const report = await runCli(
        [
          "report",
          "--from",
          payload.artifacts.resultsPath,
          "--format",
          "junit",
          "--output",
          output,
        ],
        { cwd: LEGACY_DIR, env: { PLAYWRIGHT_BROWSERS_PATH: join(root, "browser-must-not-launch") } },
      );
      expect(report.code).toBe(0);
      expect(report.stderr).toBe("");
      const generated = await readFile(output, "utf8");
      validateJunitXml(generated);
      const auditJunit = await readFile(
        JSON.parse(audit.stdout).artifacts.junitPath,
        "utf8",
      );
      expect(generated).toBe(auditJunit);
    });
  }, TEST_TIMEOUT_MS);

  it("accepts legacy results without policyEvaluation", async () => {
    await withTempDir("a11yst-legacy-junit-report-", async (root) => {
      const audit = await auditLegacy(["--json", "--no-html", "--output", join(root, "out")]);
      const payload = JSON.parse(audit.stdout) as { artifacts: { resultsPath: string } };
      const legacy = JSON.parse(await readFile(payload.artifacts.resultsPath, "utf8"));
      delete legacy.policyEvaluation;
      delete legacy.reports;
      delete legacy.baselineSummary;
      const legacyPath = join(root, "legacy-results.json");
      await writeFile(legacyPath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
      const output = join(root, "legacy.junit.xml");
      const report = await runCli(
        ["report", legacyPath, "--format", "junit", "--output", output],
        { cwd: LEGACY_DIR, env: { PLAYWRIGHT_BROWSERS_PATH: join(root, "no-browser") } },
      );
      expect(report.code).toBe(0);
      await access(output);
      validateJunitXml(await readFile(output, "utf8"));
    });
  }, TEST_TIMEOUT_MS);
});
