import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { validateConfig, defineConfig } from "@a11yst/config";
import { CI_PATHS, readTemplate } from "./helpers.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function resolveRelativeLinks(content: string, baseFile: string): string[] {
  const missing: string[] = [];
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(content)) !== null) {
    const href = match[1] ?? "";
    const target = href.split("#")[0];
    if (
      !target ||
      target.startsWith("http://") ||
      target.startsWith("https://")
    ) {
      continue;
    }
    const resolved = resolve(dirname(baseFile), target);
    if (!existsSync(resolved)) {
      missing.push(`${match[1]} (from ${baseFile})`);
    }
  }
  return missing;
}

function getCliHelp(args: string[]): string {
  return execFileSync("node", ["packages/cli/dist/bin.js", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

describe("CI documentation", () => {
  const ciDocs = readTemplate(CI_PATHS.ciDocs);
  const examplesReadme = readTemplate(CI_PATHS.examplesReadme);
  const readme = readTemplate(CI_PATHS.readme);

  it("includes docs/ci.md", () => {
    expect(existsSync(CI_PATHS.ciDocs)).toBe(true);
  });

  it("links CI guide and examples from README with valid relative targets", () => {
    expect(readme).toContain("docs/ci.md");
    expect(readme).toContain("examples/ci/");
    expect(resolveRelativeLinks(readme, CI_PATHS.readme)).toEqual([]);
  });

  it("links related docs from examples README", () => {
    expect(resolveRelativeLinks(examplesReadme, CI_PATHS.examplesReadme)).toEqual([]);
  });

  it("documents exit codes consistently", () => {
    expect(ciDocs).toContain("| `0` | Audit completed; CI policy disabled or passed |");
    expect(examplesReadme).toContain("| `0` | Audit completed; policy disabled or passed |");
    expect(readme).toContain("| `0` | Audit completed; CI policy disabled or passed |");
    for (const doc of [ciDocs, examplesReadme, readme]) {
      expect(doc).toContain("| `1` |");
      expect(doc).toContain("| `2` |");
    }
  });

  it("documents baseline workflow without auto-acceptance in CI", () => {
    for (const doc of [ciDocs, examplesReadme]) {
      expect(doc).toContain(".a11yst/baseline.json");
      expect(doc).toContain(".a11yst/results/");
      expect(doc).toContain("baseline update --accept-new");
    }
    expect(ciDocs).toContain(
      "A baseline records known accessibility debt. It does not make that debt accessible or compliant.",
    );
  });

  it("avoids unsafe or unsupported claims in templates and examples README", () => {
    const templateSources = [
      readTemplate(CI_PATHS.githubBase),
      readTemplate(CI_PATHS.githubCodeScanning),
      readTemplate(CI_PATHS.gitlab),
    ];
    for (const source of templateSources) {
      expect(source).not.toContain("pull_request_target");
    }
    for (const doc of [examplesReadme]) {
      expect(doc).not.toMatch(/certif(y|ies) WCAG/i);
      expect(doc).not.toMatch(/automatic pull-request comment/i);
    }
    expect(ciDocs).not.toMatch(/TODO\b/);
    expect(ciDocs).toMatch(/No GitHub App/);
  });

  it("documents template output paths that match the YAML templates", () => {
    const github = readTemplate(CI_PATHS.githubBase);
    for (const path of [
      ".a11yst/ci/a11yst.sarif",
      ".a11yst/ci/a11yst.junit.xml",
      ".a11yst/ci/a11yst.md",
      ".a11yst/ci/github-annotations.txt",
      ".a11yst/ci/a11yst-results.json",
    ]) {
      expect(ciDocs).toContain(path);
      expect(github).toContain(path);
    }
  });

  it("documents audit flags that exist in a11yst audit --help", () => {
    const auditHelp = getCliHelp(["audit", "--help"]);
    for (const flag of [
      "--fail-on-new",
      "--fail-on-regression",
      "--fail-on-expired-classification",
      "--minimum-severity",
      "--sarif-output",
      "--junit-output",
      "--markdown-output",
      "--github-annotations-output",
      "--github-step-summary",
    ]) {
      expect(auditHelp).toContain(flag);
      expect(ciDocs).toContain(flag.replace("<", "").split(" ")[0]);
    }
  });

  it("documents report formats that exist in a11yst report --help", () => {
    const reportHelp = getCliHelp(["report", "--help"]);
    for (const format of ["html", "sarif", "junit", "markdown", "github-annotations"]) {
      expect(reportHelp).toContain(format);
    }
    expect(ciDocs).toContain("SARIF");
    expect(ciDocs).toContain("JUnit");
    expect(ciDocs).toContain("Markdown");
    expect(ciDocs).toContain("GitHub annotations");
  });

  it("documents Node and pnpm alignment with repository metadata", () => {
    const pkg = JSON.parse(readFileSync(CI_PATHS.packageJson, "utf8")) as {
      engines: { node: string };
      packageManager: string;
    };
    expect(readFileSync(CI_PATHS.nvmrc, "utf8").trim()).toBe("20");
    expect(pkg.engines.node).toContain("20");
    expect(pkg.packageManager).toContain("pnpm@");
    expect(examplesReadme).toContain(".nvmrc");
    expect(examplesReadme).toContain("packageManager");
  });
});

describe("examples/ci/a11yst.config.ts", () => {
  it("uses defineConfig with valid ci policy and reports", () => {
    const source = readTemplate(CI_PATHS.exampleConfig);
    expect(source).toContain("defineConfig");
    expect(source).toContain("@a11yst/config");

    const resolved = validateConfig(
      defineConfig({
        ci: {
          failOnNew: true,
          failOnRegression: true,
          failOnExpiredClassification: true,
          minimumSeverity: "high",
        },
        reports: {
          sarif: true,
          junit: true,
          markdown: true,
          githubAnnotations: false,
          githubStepSummary: false,
        },
        projects: [
          {
            name: "web",
            platform: "web",
            baseUrl: "http://127.0.0.1:3000",
            routes: ["/"],
          },
        ],
      }),
    );
    expect(resolved.ci.failOnNew).toBe(true);
    expect(resolved.ci.failOnRegression).toBe(true);
    expect(resolved.ci.failOnExpiredClassification).toBe(true);
    expect(resolved.ci.minimumSeverity).toBe("high");
    expect(resolved.reports?.sarif).toBe(true);
    expect(resolved.reports?.junit).toBe(true);
    expect(resolved.reports?.markdown).toBe(true);
    expect(resolved.reports?.githubAnnotations).toBe(false);
    expect(resolved.reports?.githubStepSummary).toBe(false);
  });

  it("contains no absolute paths or secret-like literals", () => {
    const source = readTemplate(CI_PATHS.exampleConfig);
    expect(source).not.toMatch(/\/Users\//);
    expect(source).not.toMatch(/ghp_[A-Za-z0-9]+/);
    expect(source).toContain("defineConfig");
    expect(source).toContain("@a11yst/config");
  });
});
