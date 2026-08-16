import { describe, expect, it } from "vitest";
import { CI_PATHS, countOccurrences, parseTemplate, readTemplate } from "./helpers.js";

describe("GitLab CI template", () => {
  const raw = readTemplate(CI_PATHS.gitlab);
  const doc = parseTemplate(CI_PATHS.gitlab) as Record<string, unknown>;

  it("parses as valid YAML", () => {
    expect(doc.a11yst).toBeDefined();
  });

  it("defines the a11yst job with test stage and Node 20 image", () => {
    const job = doc.a11yst as Record<string, unknown>;
    expect(job.stage).toBe("test");
    expect(job.image).toBe("node:20-bookworm");
  });

  it("includes rules for merge requests, default branch, and manual runs", () => {
    expect(raw).toContain('$CI_PIPELINE_SOURCE == "merge_request_event"');
    expect(raw).toContain("$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH");
    expect(raw).toContain('$CI_PIPELINE_SOURCE == "web"');
  });

  it("enables Corepack, frozen install, and Chromium", () => {
    expect(raw).toContain("corepack enable");
    expect(raw).toContain("pnpm install --frozen-lockfile");
    expect(raw).toContain("playwright install --with-deps chromium");
  });

  it("runs exactly one audit with policy flags and report outputs", () => {
    expect(countOccurrences(raw, "pnpm exec a11yst audit")).toBe(1);
    expect(raw).toContain("--fail-on-new");
    expect(raw).toContain("--fail-on-regression");
    expect(raw).toContain("--fail-on-expired-classification");
    expect(raw).toContain("--minimum-severity high");
    expect(raw).toContain("--sarif-output .a11yst/ci/a11yst.sarif");
    expect(raw).toContain("--junit-output .a11yst/ci/a11yst.junit.xml");
    expect(raw).toContain("--markdown-output .a11yst/ci/a11yst.md");
    expect(raw).toContain("--json > .a11yst/ci/a11yst-results.json");
  });

  it("captures and preserves exit status without allow_failure or || true", () => {
    expect(raw).toContain("set +e");
    expect(raw).toContain("status=$?");
    expect(raw).toContain("set -e");
    expect(raw).toContain('exit "$status"');
    expect(raw).not.toContain("allow_failure: true");
    expect(raw).not.toMatch(/a11yst audit[\s\S]*\|\| true/);
  });

  it("prints markdown only when the file exists", () => {
    expect(raw).toContain('if [ -f .a11yst/ci/a11yst.md ]; then');
    expect(raw).toContain("cat .a11yst/ci/a11yst.md");
  });

  it("publishes artifacts always with junit report path", () => {
    const job = doc.a11yst as Record<string, unknown>;
    const artifacts = job.artifacts as Record<string, unknown>;
    expect(artifacts.when).toBe("always");
    expect(artifacts.paths).toEqual([".a11yst/ci/", ".a11yst/results/"]);
    const reports = artifacts.reports as Record<string, string>;
    expect(reports.junit).toBe(".a11yst/ci/a11yst.junit.xml");
  });

  it("does not use GitHub-specific commands, tokens, or HTTP uploads", () => {
    expect(raw).not.toContain("GITHUB_STEP_SUMMARY");
    expect(raw).not.toContain("github-annotations");
    expect(raw).not.toContain("curl ");
    expect(raw).not.toContain("wget ");
    expect(raw).not.toMatch(/CI_[A-Z_]*TOKEN/);
  });
});
