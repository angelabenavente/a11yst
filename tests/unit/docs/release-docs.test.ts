import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getRepoRoot } from "../../helpers/release/workspace-packages.js";

async function readRootDoc(filename: string): Promise<string> {
  return readFile(join(getRepoRoot(), filename), "utf8");
}

describe("release documentation contracts", () => {
  it("includes SECURITY.md without fake contact or SLA promises", async () => {
    const security = await readRootDoc("SECURITY.md");
    expect(security).toContain("# Security Policy");
    expect(security).not.toMatch(/security@example\.com|within 24 hours|24-hour/i);
    expect(security).not.toMatch(/open a public issue/i);
  });

  it("includes CONTRIBUTING.md with real development commands", async () => {
    const contributing = await readRootDoc("CONTRIBUTING.md");
    expect(contributing).toContain("pnpm install --frozen-lockfile");
    expect(contributing).toContain("pnpm build");
    expect(contributing).toContain("pnpm typecheck");
    expect(contributing).toContain("pnpm lint");
    expect(contributing).toContain("pnpm test:unit");
    expect(contributing).toContain("pnpm exec playwright install chromium");
    expect(contributing).not.toMatch(/^pnpm test:all/m);
    expect(contributing).toContain("There is no `pnpm test:all`");
    expect(contributing).not.toMatch(/\bWCAG compliant\b|\bcertified\b|guaranteed accessible/i);
  });

  it("includes CHANGELOG.md with the prepared 1.0.0 release", async () => {
    const changelog = await readRootDoc("CHANGELOG.md");
    expect(changelog).toContain("## Unreleased");
    expect(changelog).toContain("## [1.0.0] - 2026-08-23");
  });

  it("includes an actionable release process", async () => {
    const release = await readFile(join(getRepoRoot(), "docs/release.md"), "utf8");
    expect(release).toContain("## Versioning");
    expect(release).toContain("confirmed: MPL-2.0");
    expect(release).toContain("pnpm -r --filter './packages/*' publish --dry-run");
    expect(release).toContain("pnpm -r --filter './packages/*' publish");
    expect(release).toContain("pnpm exec playwright install chromium");
  });
});
