import { access, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE_EXAMPLES, copyBaselineExample } from "../../helpers/baseline.js";
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

describe.sequential("audit GitHub annotations integration", () => {
  it("does not create GitHub annotations by default", async () => {
    const result = await auditLegacy(["--json", "--no-html"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts?: { githubAnnotationsPath?: string; manifestPath?: string };
      reports?: { githubAnnotations?: unknown };
    };
    expect(payload.artifacts?.githubAnnotationsPath).toBeUndefined();
    expect(payload.reports?.githubAnnotations).toBeUndefined();
    const manifest = JSON.parse(
      await readFile(payload.artifacts!.manifestPath as string, "utf8"),
    );
    expect(manifest.reports?.githubAnnotations).toBeUndefined();
  }, TEST_TIMEOUT_MS);

  it("generates bundle GitHub annotations with --github-annotations", async () => {
    const result = await auditLegacy(["--json", "--no-html", "--github-annotations"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { githubAnnotationsPath: string; manifestPath: string };
      reports: {
        githubAnnotations: {
          path: string;
          summary: { annotations: number; errors: number };
        };
      };
    };
    expect(payload.reports.githubAnnotations.path).toBe("reports/github-annotations.txt");
    await access(payload.artifacts.githubAnnotationsPath);
    const commands = await readFile(payload.artifacts.githubAnnotationsPath, "utf8");
    if (commands.length > 0) {
      expect(commands.endsWith("\n")).toBe(true);
      expect(commands).toMatch(/^::(error|warning|notice)/m);
    }
    const manifest = JSON.parse(await readFile(payload.artifacts.manifestPath, "utf8"));
    expect(manifest.reports.githubAnnotations.path).toBe("reports/github-annotations.txt");
  }, TEST_TIMEOUT_MS);

  it("writes identical custom and bundle GitHub annotation copies", async () => {
    await withTempDir("a11yst-github-output-", async (root) => {
      const customPath = join(root, "output with spaces", "github-annotations.txt");
      const result = await auditLegacy([
        "--json",
        "--no-html",
        "--github-annotations",
        "--fail-on-new",
        "--github-annotations-output",
        customPath,
      ]);
      expect(result.code).toBe(2);
      const payload = JSON.parse(result.stdout) as {
        artifacts: { githubAnnotationsPath: string };
      };
      const bundleContents = await readFile(payload.artifacts.githubAnnotationsPath, "utf8");
      const customContents = await readFile(customPath, "utf8");
      expect(bundleContents).toBe(customContents);
    });
  }, TEST_TIMEOUT_MS);

  it("still generates GitHub annotations when CI policy fails with exit code 2", async () => {
    const result = await auditLegacy([
      "--json",
      "--no-html",
      "--github-annotations",
      "--fail-on-new",
    ]);
    expect(result.code).toBe(2);
    const payload = JSON.parse(result.stdout) as {
      artifacts: { githubAnnotationsPath: string };
      policyEvaluation: { status: string };
      reports: { githubAnnotations: { summary: { errors: number } } };
    };
    expect(payload.policyEvaluation.status).toBe("failed");
    await access(payload.artifacts.githubAnnotationsPath);
    const commands = await readFile(payload.artifacts.githubAnnotationsPath, "utf8");
    expect(payload.reports.githubAnnotations.summary.errors).toBeGreaterThan(0);
    expect(commands).toContain("::error");
    expect(commands).toContain("a11yst%3A");
  }, TEST_TIMEOUT_MS);

  it("generates Markdown, GitHub annotations, and step summary together", async () => {
    await withTempDir("a11yst-github-bundle-", async (root) => {
      const stepSummaryPath = join(root, "step-summary.md");
      const result = await auditLegacy([
        "--json",
        "--no-html",
        "--github-annotations",
        "--github-step-summary",
        "--fail-on-new",
      ], {
        GITHUB_STEP_SUMMARY: stepSummaryPath,
      });
      expect(result.code).toBe(2);
      const payload = JSON.parse(result.stdout) as {
        artifacts: {
          markdownPath: string;
          githubAnnotationsPath: string;
          manifestPath: string;
        };
        reports: {
          markdown: { path: string };
          githubAnnotations: { path: string };
        };
        githubStepSummaryWritten?: boolean;
      };
      expect(payload.reports.markdown.path).toBe("reports/a11yst.md");
      expect(payload.reports.githubAnnotations.path).toBe("reports/github-annotations.txt");
      await access(payload.artifacts.markdownPath);
      await access(payload.artifacts.githubAnnotationsPath);
      const markdown = await readFile(payload.artifacts.markdownPath, "utf8");
      const commands = await readFile(payload.artifacts.githubAnnotationsPath, "utf8");
      const summary = await readFile(stepSummaryPath, "utf8");
      expect(markdown).toContain("## CI policy breaches");
      expect(commands).toContain("::error");
      expect(summary).toBe(markdown);
      expect(payload.githubStepSummaryWritten).toBe(true);
      const manifest = JSON.parse(await readFile(payload.artifacts.manifestPath, "utf8"));
      expect(manifest.reports.markdown.path).toBe("reports/a11yst.md");
      expect(manifest.reports.githubAnnotations.path).toBe("reports/github-annotations.txt");
      expect(manifest.reports.githubStepSummary?.written).toBe(true);
    });
  }, TEST_TIMEOUT_MS);

  it("records policy not-evaluated in GitHub annotations when enabled without baseline", async () => {
    await withTempDir("a11yst-github-policy-", async (workspace) => {
      await seedLegacyWorkspace(workspace, { withBaseline: false });
      const port = await getFreePort();
      await writeMinimalConfig(workspace, port);
      const result = await runCli(
        ["audit", "--json", "--no-html", "--github-annotations", "--fail-on-new"],
        { cwd: workspace, env: { PORT: String(port) } },
      );
      expect(result.code).toBe(1);
      const payload = JSON.parse(result.stdout) as {
        artifacts: { githubAnnotationsPath: string };
        policyEvaluation: { status: string };
      };
      expect(payload.policyEvaluation.status).toBe("not-evaluated");
      const commands = await readFile(payload.artifacts.githubAnnotationsPath, "utf8");
      expect(commands).toContain("a11yst CI policy was not evaluated");
      expect(commands).toContain("baseline comparison is unavailable");
    });
  }, TEST_TIMEOUT_MS);

  it("appends step summary on repeated writes", async () => {
    await withTempDir("a11yst-github-step-summary-", async (root) => {
      const stepSummaryPath = join(root, "step-summary.md");
      const first = await auditLegacy(
        ["--json", "--no-html", "--github-step-summary"],
        { GITHUB_STEP_SUMMARY: stepSummaryPath },
      );
      expect(first.code).toBe(0);
      const second = await auditLegacy(
        ["--json", "--no-html", "--github-step-summary"],
        { GITHUB_STEP_SUMMARY: stepSummaryPath },
      );
      expect(second.code).toBe(0);
      const summary = await readFile(stepSummaryPath, "utf8");
      const sections = summary.split("# a11yst Accessibility Report");
      expect(sections.length).toBeGreaterThan(2);
    });
  }, TEST_TIMEOUT_MS);
});
