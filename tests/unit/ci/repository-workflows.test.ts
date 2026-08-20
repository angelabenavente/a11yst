import { describe, expect, it } from "vitest";
import { CI_PATHS, parseTemplate, readTemplate } from "./helpers.js";

type Workflow = {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, { needs?: string; steps?: Array<Record<string, unknown>> }>;
};

function workflow(path: string): Workflow {
  return parseTemplate(path) as Workflow;
}

describe("repository GitHub Actions workflows", () => {
  const qualityRaw = readTemplate(CI_PATHS.repositoryQuality);
  const releaseRaw = readTemplate(CI_PATHS.repositoryReleaseGate);
  const quality = workflow(CI_PATHS.repositoryQuality);
  const release = workflow(CI_PATHS.repositoryReleaseGate);

  it("runs repository quality checks for pull requests and main", () => {
    expect(quality.on.pull_request).toBeDefined();
    expect(quality.on.push).toBeDefined();
    expect(quality.on.workflow_dispatch).toBeDefined();
    expect(qualityRaw).toContain("pnpm ci:quality");
    expect(qualityRaw).toContain("pnpm ci:integration");
    expect(quality.jobs.integration?.needs).toBe("quality");
  });

  it("installs deterministically and tests the real browser integration boundary", () => {
    for (const raw of [qualityRaw, releaseRaw]) {
      expect(raw).toContain("node-version-file: .nvmrc");
      expect(raw).toContain("corepack enable");
      expect(raw).toContain("pnpm install --frozen-lockfile");
      expect(raw).toContain("playwright install --with-deps chromium");
      expect(raw).not.toMatch(/@(main|master|latest)\b/);
    }
    expect(qualityRaw).toContain("PLAYWRIGHT_BROWSERS_PATH");
  });

  it("gates tags and manual releases without publishing", () => {
    expect(release.on.push).toBeDefined();
    expect(release.on.workflow_dispatch).toBeDefined();
    expect(releaseRaw).toContain('      - "v*"');
    expect(releaseRaw).toContain("pnpm ci:quality");
    expect(releaseRaw).toContain("pnpm ci:release");
    expect(releaseRaw).not.toMatch(/\b(?:npm|pnpm) publish\b/);
  });

  it("uses read-only repository permissions", () => {
    for (const definition of [quality, release]) {
      expect(definition.permissions).toEqual({ contents: "read" });
    }
    for (const raw of [qualityRaw, releaseRaw]) {
      expect(raw).not.toContain("pull_request_target");
      expect(raw).not.toContain("write-all");
      expect(raw).not.toContain("contents: write");
    }
  });
});
