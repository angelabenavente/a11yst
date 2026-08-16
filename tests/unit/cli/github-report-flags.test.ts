import { describe, expect, it } from "vitest";
import { runCli } from "../../helpers/cli.js";

describe("CLI GitHub report flags", () => {
  it("exposes GitHub annotation and step-summary flags on audit --help", async () => {
    const result = await runCli(["audit", "--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("--github-annotations");
    expect(result.stdout).toContain("--no-github-annotations");
    expect(result.stdout).toContain("--github-annotations-output");
    expect(result.stdout).toContain("--github-step-summary");
    expect(result.stdout).toContain("--no-github-step-summary");
    expect(result.stdout).toContain("reports/github-annotations.txt");
    expect(result.stdout).toContain("GITHUB_STEP_SUMMARY");
    // eslint-disable-next-line no-control-regex -- detect ANSI escape sequences
    expect(result.stdout).not.toMatch(/\x1b\[[0-9;]*m/);
  });

  it("exposes github-annotations as a report format", async () => {
    const result = await runCli(["report", "--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("github-annotations");
    expect(result.stdout).toContain("github-annotations.txt");
    // eslint-disable-next-line no-control-regex -- detect ANSI escape sequences
    expect(result.stdout).not.toMatch(/\x1b\[[0-9;]*m/);
  });
});
