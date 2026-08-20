import { access, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE_EXAMPLES, copyBaselineExample } from "../../helpers/baseline.js";
import { repoRoot, runCli, withTempDir } from "../../helpers/cli.js";
import { getFreePort } from "../../helpers/net.js";

const LEGACY = BASELINE_EXAMPLES.legacyHtml;
const LEGACY_DIR = join(repoRoot, LEGACY);
const TEST_TIMEOUT_MS = 240_000;

function expectBundleArtifactPath(path: string | undefined, suffix: string): void {
  expect(path).toBeDefined();
  expect(path!.replace(/\\/g, "/")).toMatch(new RegExp(`${suffix.replace(/\//g, "\\/")}$`));
}

async function auditLegacy(args: string[], env?: NodeJS.ProcessEnv) {
  const port = await getFreePort();
  return runCli(["audit", ...args], {
    cwd: LEGACY_DIR,
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

describe.sequential("audit Markdown integration", () => {
  it("creates Markdown by default", async () => {
    const result = await auditLegacy(["--json", "--no-html"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts?: { markdownPath?: string; manifestPath?: string };
      reports?: { markdown?: unknown };
    };
    expectBundleArtifactPath(payload.artifacts?.markdownPath, "reports/a11yst.md");
    expect(payload.reports?.markdown).toBeDefined();
    const manifest = JSON.parse(
      await readFile(payload.artifacts!.manifestPath as string, "utf8"),
    );
    expect(manifest.reports?.markdown?.path).toBe("reports/a11yst.md");
  }, TEST_TIMEOUT_MS);

  it("skips Markdown with --no-markdown", async () => {
    const result = await auditLegacy(["--json", "--no-html", "--no-markdown"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts?: { markdownPath?: string; manifestPath?: string };
      reports?: { markdown?: unknown };
    };
    expect(payload.artifacts?.markdownPath).toBeUndefined();
    expect(payload.reports?.markdown).toBeUndefined();
    const manifest = JSON.parse(
      await readFile(payload.artifacts!.manifestPath as string, "utf8"),
    );
    expect(manifest.reports?.markdown).toBeUndefined();
  }, TEST_TIMEOUT_MS);

  it("generates bundle Markdown with explicit output copy", async () => {
    const result = await auditLegacy(["--json", "--no-html", "--markdown-output", "./external.md"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { markdownPath: string; manifestPath: string };
      reports: {
        markdown: {
          path: string;
          summary: { findings: number; policyBreaches: number };
        };
      };
    };
    expect(payload.reports.markdown.path).toBe("reports/a11yst.md");
    expect(payload.reports.markdown.summary.findings).toBeGreaterThan(0);
    await access(payload.artifacts.markdownPath);
    const markdown = await readFile(payload.artifacts.markdownPath, "utf8");
    expect(markdown).toMatch(/^# a11yst Accessibility Report\n/);
    expect(markdown).toContain("## Status");
    expect(markdown).toContain("## Accessibility lifecycle");
    const manifest = JSON.parse(await readFile(payload.artifacts.manifestPath, "utf8"));
    expect(manifest.reports.markdown.path).toBe("reports/a11yst.md");
  }, TEST_TIMEOUT_MS);

  it("writes identical custom and bundle Markdown copies", async () => {
    await withTempDir("a11yst-markdown-output-", async (root) => {
      const customPath = join(root, "output with spaces", "a11yst.md");
      const result = await auditLegacy([
        "--json",
        "--no-html",
        "--markdown-output",
        customPath,
      ]);
      expect(result.code).toBe(0);
      const payload = JSON.parse(result.stdout) as {
        artifacts: { markdownPath: string };
      };
      const bundleContents = await readFile(payload.artifacts.markdownPath, "utf8");
      const customContents = await readFile(customPath, "utf8");
      expect(bundleContents).toBe(customContents);
      expect(bundleContents.endsWith("\n")).toBe(true);
    });
  }, TEST_TIMEOUT_MS);

  it("still generates Markdown when CI policy fails with exit code 2", async () => {
    const result = await auditLegacy(["--json", "--no-html", "--fail-on-new"]);
    expect(result.code).toBe(2);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { markdownPath: string };
      policyEvaluation: { status: string };
      reports: { markdown: { summary: { policyBreaches: number } } };
    };
    expect(payload.policyEvaluation.status).toBe("failed");
    await access(payload.artifacts.markdownPath);
    const markdown = await readFile(payload.artifacts.markdownPath, "utf8");
    expect(payload.reports.markdown.summary.policyBreaches).toBeGreaterThan(0);
    expect(markdown).toContain("## CI policy breaches");
    expect(markdown).toContain("Expected exit code: 2");
  }, TEST_TIMEOUT_MS);

  it("does not generate Markdown for operational baseline errors", async () => {
    await withTempDir("a11yst-markdown-op-error-", async (workspace) => {
      await copyBaselineExample(LEGACY, workspace);
      await rm(join(workspace, "a11yst.config.ts"), { force: true });
      const port = await getFreePort();
      const result = await runCli(
        ["audit", "--json", "--baseline", ".a11yst/missing-baseline.json"],
        { cwd: workspace, env: { PORT: String(port) } },
      );
      expect(result.code).toBe(1);
      expect(result.stdout).not.toContain('"markdownPath"');
    });
  }, TEST_TIMEOUT_MS);

  it("generates Markdown alongside JUnit in a single audit", async () => {
    const result = await auditLegacy(["--json", "--no-html", "--junit"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { junitPath: string; markdownPath: string; manifestPath: string };
      reports: {
        junit: { path: string };
        markdown: { path: string };
      };
    };
    expect(payload.reports.junit.path).toBe("reports/a11yst.junit.xml");
    expect(payload.reports.markdown.path).toBe("reports/a11yst.md");
    await access(payload.artifacts.junitPath);
    await access(payload.artifacts.markdownPath);
    const manifest = JSON.parse(await readFile(payload.artifacts.manifestPath, "utf8"));
    expect(manifest.reports.junit.path).toBe("reports/a11yst.junit.xml");
    expect(manifest.reports.markdown.path).toBe("reports/a11yst.md");
  }, TEST_TIMEOUT_MS);

  it("records policy not-evaluated in Markdown when enabled without baseline", async () => {
    await withTempDir("a11yst-markdown-policy-", async (workspace) => {
      await seedLegacyWorkspace(workspace, { withBaseline: false });
      const port = await getFreePort();
      await writeMinimalConfig(workspace, port);
      const result = await runCli(
        ["audit", "--json", "--no-html", "--fail-on-new"],
        { cwd: workspace, env: { PORT: String(port) } },
      );
      expect(result.code).toBe(1);
      const payload = JSON.parse(result.stdout) as {
        artifacts: { markdownPath: string };
        policyEvaluation: { status: string };
      };
      expect(payload.policyEvaluation.status).toBe("not-evaluated");
      const markdown = await readFile(payload.artifacts.markdownPath, "utf8");
      expect(markdown).toContain("| CI policy | Not evaluated |");
      expect(markdown).toContain("baseline comparison is unavailable");
    });
  }, TEST_TIMEOUT_MS);
});
