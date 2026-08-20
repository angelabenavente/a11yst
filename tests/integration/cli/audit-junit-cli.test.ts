import { access, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateAgainstOfficialSchema } from "../../unit/sarif/schema-helper.js";
import {
  junitRootMetric,
  junitSuiteNames,
  junitTestCaseNames,
  validateJunitXml,
} from "../../unit/junit/xml-helper.js";
import { BASELINE_EXAMPLES, copyBaselineExample } from "../../helpers/baseline.js";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const LEGACY = BASELINE_EXAMPLES.legacyHtml;
const LEGACY_DIR = join(repoRoot, LEGACY);
const MIXED = BASELINE_EXAMPLES.mixedWorkspace;
const MIXED_DIR = join(repoRoot, MIXED);
const FLOW = BASELINE_EXAMPLES.flowRegression;
const FLOW_DIR = join(repoRoot, FLOW);
const TEST_TIMEOUT_MS = 240_000;

async function auditLegacy(args: string[], env?: NodeJS.ProcessEnv) {
  const port = await getFreePort();
  return runCli(["audit", ...args], {
    cwd: LEGACY_DIR,
    env: { PORT: String(port), ...env },
  });
}

async function auditMixed(args: string[], env?: NodeJS.ProcessEnv) {
  const port = await getFreePort();
  return runCli(["audit", ...args], {
    cwd: MIXED_DIR,
    env: { PORT: String(port), ...env },
  });
}

async function auditFlow(args: string[], env?: NodeJS.ProcessEnv) {
  const port = await getFreePort();
  return runCli(["audit", ...args], {
    cwd: FLOW_DIR,
    env: { PORT: String(port), ...env },
  });
}

async function writeMinimalConfig(workspace: string, port: number, ciBlock = ""): Promise<void> {
  const source = `export default {
${ciBlock}  baseline: {
    file: ".a11yst/baseline.json",
    compare: true,
    classifications: true,
  },
  projects: [
    {
      name: "baseline-legacy-html",
      platform: "web",
      framework: "html",
      rootDir: ".",
      baseUrl: "http://127.0.0.1:${port}",
      devServer: {
        command: "node serve.mjs",
        url: "http://127.0.0.1:${port}",
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes: [
        { id: "home", name: "Home", path: "/" },
        { id: "contact", name: "Contact", path: "/contact" },
        { id: "fixed", name: "Fixed", path: "/fixed" },
        { id: "review", name: "Review", path: "/review" },
      ],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
};
`;
  await writeFile(join(workspace, "a11yst.config.mjs"), source, "utf8");
}

async function seedLegacyWorkspace(workspace: string, options: { withBaseline?: boolean } = {}) {
  await copyBaselineExample(LEGACY, workspace);
  await rm(join(workspace, "a11yst.config.ts"), { force: true });
  if (options.withBaseline === false) {
    await rm(join(workspace, ".a11yst/baseline.json"), { force: true });
  }
}

describe.sequential("audit JUnit integration", () => {
  it("does not create JUnit by default", async () => {
    const result = await auditLegacy(["--json", "--no-html"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts?: { junitPath?: string; manifestPath?: string };
      reports?: { junit?: unknown };
    };
    expect(payload.artifacts?.junitPath).toBeUndefined();
    expect(payload.reports?.junit).toBeUndefined();
    const manifest = JSON.parse(
      await readFile(payload.artifacts!.manifestPath as string, "utf8"),
    );
    expect(manifest.reports?.junit).toBeUndefined();
  }, TEST_TIMEOUT_MS);

  it("generates bundle JUnit with --junit", async () => {
    const result = await auditLegacy(["--json", "--no-html", "--junit"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { junitPath: string; manifestPath: string; outputDirectory: string };
      reports: {
        junit: {
          path: string;
          summary: { tests: number; failures: number; errors: number; skipped: number };
        };
      };
    };
    expect(payload.reports.junit.path).toBe("reports/a11yst.junit.xml");
    expect(payload.reports.junit.summary.tests).toBeGreaterThan(0);
    await access(payload.artifacts.junitPath);
    const xml = await readFile(payload.artifacts.junitPath, "utf8");
    validateJunitXml(xml);
    const manifest = JSON.parse(await readFile(payload.artifacts.manifestPath, "utf8"));
    expect(manifest.reports.junit.path).toBe("reports/a11yst.junit.xml");
    expect(manifest.reports.junit.tests).toBe(payload.reports.junit.summary.tests);
  }, TEST_TIMEOUT_MS);

  it("writes identical custom and bundle JUnit copies", async () => {
    await withTempDir("a11yst-junit-output-", async (root) => {
      const customPath = join(root, "output with spaces", "a11yst.junit.xml");
      const result = await auditLegacy([
        "--json",
        "--no-html",
        "--junit",
        "--junit-output",
        customPath,
      ]);
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        artifacts: { junitPath: string };
      };
      const bundleContents = await readFile(payload.artifacts.junitPath, "utf8");
      const customContents = await readFile(customPath, "utf8");
      expect(bundleContents).toBe(customContents);
      validateJunitXml(bundleContents);
    });
  }, TEST_TIMEOUT_MS);

  it("still generates JUnit when CI policy fails with exit code 2", async () => {
    const result = await auditLegacy(["--json", "--no-html", "--junit", "--fail-on-new"]);
    expect(result.code).toBe(2);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { junitPath: string };
      policyEvaluation: { status: string };
      reports: { junit: { summary: { failures: number } } };
    };
    expect(payload.policyEvaluation.status).toBe("failed");
    await access(payload.artifacts.junitPath);
    const parsed = validateJunitXml(await readFile(payload.artifacts.junitPath, "utf8"));
    expect(payload.reports.junit.summary.failures).toBeGreaterThan(0);
    expect(junitRootMetric(parsed, "failures")).toBeGreaterThan(0);
    expect(
      junitTestCaseNames(parsed).some((name) => name.startsWith("policy / new /")),
    ).toBe(true);
  }, TEST_TIMEOUT_MS);

  it("does not generate JUnit for operational baseline errors", async () => {
    await withTempDir("a11yst-junit-op-error-", async (workspace) => {
      await copyBaselineExample(LEGACY, workspace);
      await rm(join(workspace, "a11yst.config.ts"), { force: true });
      const port = await getFreePort();
      const result = await runCli(
        ["audit", "--json", "--junit", "--baseline", ".a11yst/missing-baseline.json"],
        { cwd: workspace, env: { PORT: String(port) } },
      );
      expect(result.code).toBe(1);
      expect(result.stdout).not.toContain('"junitPath"');
    });
  }, TEST_TIMEOUT_MS);

  it("generates both SARIF and JUnit in a single audit", async () => {
    const result = await auditLegacy(["--json", "--no-html", "--sarif", "--junit"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { sarifPath: string; junitPath: string; manifestPath: string };
      reports: {
        sarif: { path: string };
        junit: { path: string };
      };
    };
    expect(payload.reports.sarif.path).toBe("reports/a11yst.sarif");
    expect(payload.reports.junit.path).toBe("reports/a11yst.junit.xml");
    await access(payload.artifacts.sarifPath);
    await access(payload.artifacts.junitPath);
    validateAgainstOfficialSchema(
      JSON.parse(await readFile(payload.artifacts.sarifPath, "utf8")),
    );
    validateJunitXml(await readFile(payload.artifacts.junitPath, "utf8"));
    const manifest = JSON.parse(await readFile(payload.artifacts.manifestPath, "utf8"));
    expect(manifest.reports.sarif.path).toBe("reports/a11yst.sarif");
    expect(manifest.reports.junit.path).toBe("reports/a11yst.junit.xml");
  }, TEST_TIMEOUT_MS);

  it("records policy not-evaluated in JUnit when enabled without baseline", async () => {
    await withTempDir("a11yst-junit-policy-", async (workspace) => {
      await seedLegacyWorkspace(workspace, { withBaseline: false });
      const port = await getFreePort();
      await writeMinimalConfig(workspace, port);
      const result = await runCli(
        ["audit", "--json", "--no-html", "--junit", "--fail-on-new"],
        { cwd: workspace, env: { PORT: String(port) } },
      );
      expect(result.code).toBe(1);
      const payload = JSON.parse(result.stdout) as {
        artifacts: { junitPath: string };
        policyEvaluation: { status: string };
      };
      expect(payload.policyEvaluation.status).toBe("not-evaluated");
      const parsed = validateJunitXml(await readFile(payload.artifacts.junitPath, "utf8"));
      expect(junitRootMetric(parsed, "errors")).toBeGreaterThan(0);
      expect(junitTestCaseNames(parsed)).toContain("policy / evaluation");
    });
  }, TEST_TIMEOUT_MS);

  it("represents mixed-workspace web runs in JUnit", async () => {
    const result = await auditMixed(["--json", "--no-html", "--junit"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { junitPath: string };
      runs: Array<{ platform: string; status: string }>;
    };
    expect(payload.runs.length).toBeGreaterThan(0);
    expect(payload.runs.every((run) => run.platform === "web")).toBe(true);
    expect(payload.runs.some((run) => run.status === "completed")).toBe(true);
    const parsed = validateJunitXml(await readFile(payload.artifacts.junitPath, "utf8"));
    expect(junitSuiteNames(parsed).some((name) => name.includes("baseline-mixed-web"))).toBe(true);
    expect(junitSuiteNames(parsed).some((name) => name.includes("baseline-mixed-mobile"))).toBe(
      false,
    );
  }, TEST_TIMEOUT_MS);

  it("includes flow checkpoint names in JUnit testcase output", async () => {
    const result = await auditFlow(["--json", "--no-html", "--junit", "--flows-only"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { junitPath: string };
      runs: Array<{ kind?: string; checkpointId?: string }>;
    };
    expect(payload.runs.some((run) => run.kind === "flow-checkpoint")).toBe(true);
    expect(payload.runs.some((run) => run.checkpointId === "panel-open")).toBe(true);
    const names = junitTestCaseNames(
      validateJunitXml(await readFile(payload.artifacts.junitPath, "utf8")),
    );
    expect(names.some((name) => name.includes("checkpoint panel-open"))).toBe(true);
    expect(names.some((name) => name.includes("checkpoint cart-ready"))).toBe(true);
  }, TEST_TIMEOUT_MS);
});
