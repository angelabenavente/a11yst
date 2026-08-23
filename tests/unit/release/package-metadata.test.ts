import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeRuntimeClosure,
  toMinimalPackageMap,
} from "../../helpers/release/package-graph.js";
import { evaluateReleaseReadiness } from "../../helpers/release/readiness.js";
import {
  findCliPackage,
  getRepoRoot,
  loadWorkspacePackages,
} from "../../helpers/release/workspace-packages.js";

describe("release package metadata", () => {
  it("keeps publishable package descriptions present and non-empty", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);

    for (const name of closure) {
      const pkg = packages.find((entry) => entry.manifest.name === name)!;
      expect(pkg.manifest.description?.trim().length).toBeGreaterThan(0);
      expect(pkg.manifest.description).not.toMatch(/WCAG compliant|certified|automatic fixes/i);
    }
  });

  it("includes README and legal files in the consumer CLI files allowlist only", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);

    for (const name of closure) {
      const pkg = packages.find((entry) => entry.manifest.name === name)!;
      if (name === "@a11yst/cli") {
        expect(pkg.manifest.files).toEqual([
          "dist",
          "README.md",
          "LICENSE",
          "NOTICE.md",
          "TRADEMARKS.md",
        ]);
      } else {
        expect(pkg.manifest.files).toEqual(["dist", "LICENSE"]);
      }
    }
  });

  it("adds discoverability keywords only to the consumer CLI package", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    expect(cli.manifest.keywords).toEqual([
      "accessibility",
      "a11y",
      "testing",
      "regression",
      "playwright",
      "axe",
      "cli",
    ]);

    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);
    for (const name of closure) {
      if (name === "@a11yst/cli") {
        continue;
      }
      const pkg = packages.find((entry) => entry.manifest.name === name)!;
      expect(pkg.manifest.keywords).toBeUndefined();
    }
  });

  it("reports repository and publish metadata ready", async () => {
    const readiness = await evaluateReleaseReadiness();
    expect(readiness.publication.license).toBe(true);
    expect(readiness.publication.repository).toBe(true);
    expect(readiness.publication.publishAccess).toBe(true);
  });

  it("keeps publishable package versions synchronized and SemVer-parseable", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);
    const versions = closure.map(
      (name) => packages.find((entry) => entry.manifest.name === name)!.manifest.version,
    );
    expect(new Set(versions)).toEqual(new Set(["1.0.0"]));
  });

  it("ships a self-contained CLI package README", async () => {
    const readme = await readFile(join(getRepoRoot(), "packages/cli/README.md"), "utf8");
    expect(readme).toContain("@a11yst/cli");
    expect(readme).toContain("a11yst");
    expect(readme).toContain("Node.js **>= 22.12**");
    expect(readme).toContain("pnpm exec playwright install chromium");
    expect(readme).toContain("pnpm add -D @a11yst/cli");
    expect(readme).toContain("MPL-2.0");
    expect(readme).not.toMatch(/\bWCAG compliant\b|\bcertified\b|guaranteed accessible/i);
    expect(readme).not.toContain("../../docs/");
  });
});
