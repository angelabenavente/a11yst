import { describe, expect, it } from "vitest";
import {
  resolveGitHubAnnotationsOptions,
  resolveGitHubStepSummaryOptions,
} from "@a11yst/core";

describe("resolveGitHubAnnotationsOptions", () => {
  it("defaults to disabled", () => {
    expect(resolveGitHubAnnotationsOptions({})).toEqual({ enabled: false });
  });

  it("enables from config", () => {
    expect(
      resolveGitHubAnnotationsOptions({
        config: {
          githubAnnotations: true,
          githubAnnotationsOutput: "./config-annotations.txt",
        },
      }),
    ).toEqual({ enabled: true, outputPath: "./config-annotations.txt" });
  });

  it("enables from CLI and overrides disabled config", () => {
    expect(
      resolveGitHubAnnotationsOptions({
        config: { githubAnnotations: false },
        cli: { githubAnnotations: true },
      }),
    ).toEqual({ enabled: true });
  });

  it("allows CLI --no-github-annotations to disable config", () => {
    expect(
      resolveGitHubAnnotationsOptions({
        config: {
          githubAnnotations: true,
          githubAnnotationsOutput: "./config-annotations.txt",
        },
        cli: { noGitHubAnnotations: true },
      }),
    ).toEqual({ enabled: false });
  });

  it("treats CLI output path as enabling", () => {
    expect(
      resolveGitHubAnnotationsOptions({
        cli: { githubAnnotationsOutput: "./artifacts/github-annotations.txt" },
      }),
    ).toEqual({ enabled: true, outputPath: "./artifacts/github-annotations.txt" });
  });

  it("prefers CLI output over config output", () => {
    expect(
      resolveGitHubAnnotationsOptions({
        config: {
          githubAnnotations: true,
          githubAnnotationsOutput: "./config-annotations.txt",
        },
        cli: { githubAnnotationsOutput: "./cli-annotations.txt" },
      }),
    ).toEqual({ enabled: true, outputPath: "./cli-annotations.txt" });
  });

  it("rejects empty output paths", () => {
    expect(() =>
      resolveGitHubAnnotationsOptions({ cli: { githubAnnotationsOutput: "   " } }),
    ).toThrow(/must not be empty/);
  });

  it("does not mutate config input", () => {
    const config = {
      githubAnnotations: true,
      githubAnnotationsOutput: "./config-annotations.txt",
    };
    resolveGitHubAnnotationsOptions({ config, cli: { githubAnnotations: true } });
    expect(config).toEqual({
      githubAnnotations: true,
      githubAnnotationsOutput: "./config-annotations.txt",
    });
  });
});

describe("resolveGitHubStepSummaryOptions", () => {
  it("defaults to disabled", () => {
    expect(resolveGitHubStepSummaryOptions({})).toEqual({ enabled: false });
  });

  it("enables from config", () => {
    expect(
      resolveGitHubStepSummaryOptions({
        config: { githubStepSummary: true },
      }),
    ).toEqual({ enabled: true });
  });

  it("enables from CLI and overrides disabled config", () => {
    expect(
      resolveGitHubStepSummaryOptions({
        config: { githubStepSummary: false },
        cli: { githubStepSummary: true },
      }),
    ).toEqual({ enabled: true });
  });

  it("allows CLI --no-github-step-summary to disable config", () => {
    expect(
      resolveGitHubStepSummaryOptions({
        config: { githubStepSummary: true },
        cli: { noGitHubStepSummary: true },
      }),
    ).toEqual({ enabled: false });
  });
});
