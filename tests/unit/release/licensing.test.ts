import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeRuntimeClosure,
  toMinimalPackageMap,
} from "../../helpers/release/package-graph.js";
import {
  evaluateReleaseReadiness,
  findLicenseFile,
} from "../../helpers/release/readiness.js";
import {
  findCliPackage,
  getRepoRoot,
  loadWorkspacePackages,
} from "../../helpers/release/workspace-packages.js";

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

describe("MPL-2.0 licensing", () => {
  it("includes canonical root LICENSE text from Mozilla MPL-2.0", async () => {
    const repoRoot = getRepoRoot();
    const filename = await findLicenseFile(repoRoot);
    expect(filename).toBe("LICENSE");
    const content = await readFile(join(repoRoot, filename!), "utf8");
    expect(content.startsWith("Mozilla Public License Version 2.0")).toBe(true);
    expect(content).toContain("Exhibit A - Source Code Form License Notice");
    expect(content).toContain("Exhibit B - \"Incompatible With Secondary Licenses\" Notice");
    expect(content.length).toBeGreaterThan(10_000);
  });

  it("assigns MPL-2.0 to every publishable package manifest", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);
    expect(closure.length).toBeGreaterThanOrEqual(27);

    for (const name of closure) {
      const pkg = packages.find((entry) => entry.manifest.name === name)!;
      expect(pkg.manifest.license).toBe("MPL-2.0");
    }
  });

  it("includes matching LICENSE copies in every publishable package directory", async () => {
    const repoRoot = getRepoRoot();
    const rootLicense = await readFile(join(repoRoot, "LICENSE"), "utf8");
    const rootHash = hashContent(rootLicense);
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);

    for (const name of closure) {
      const pkg = packages.find((entry) => entry.manifest.name === name)!;
      const packageLicense = await readFile(join(pkg.dirAbsolute, "LICENSE"), "utf8");
      expect(hashContent(packageLicense)).toBe(rootHash);
    }
  });

  it("includes LICENSE in publishable package files allowlists", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const map = toMinimalPackageMap(packages);
    const { closure } = computeRuntimeClosure(map, cli.manifest.name);

    for (const name of closure) {
      const pkg = packages.find((entry) => entry.manifest.name === name)!;
      expect(pkg.manifest.files).toContain("LICENSE");
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

  it("includes CLI legal notices alongside LICENSE", async () => {
    const packages = await loadWorkspacePackages();
    const cli = findCliPackage(packages)!;
    const notice = await readFile(join(cli.dirAbsolute, "NOTICE.md"), "utf8");
    const trademarks = await readFile(join(cli.dirAbsolute, "TRADEMARKS.md"), "utf8");
    expect(notice).toContain("Mozilla Public License 2.0");
    expect(trademarks).toContain("MPL-2.0");
    expect(trademarks).not.toContain("®");
    expect(trademarks).toMatch(/does not claim that a11yst is a registered trademark/i);
  });

  it("keeps root private and reports license readiness without release-license-undecided", async () => {
    const rootManifest = JSON.parse(
      readFileSync(join(getRepoRoot(), "package.json"), "utf8"),
    ) as { private?: boolean; license?: string; publishConfig?: unknown };
    expect(rootManifest.private).toBe(true);
    expect(rootManifest.license).toBe("MPL-2.0");
    expect(rootManifest.publishConfig).toBeUndefined();

    const readiness = await evaluateReleaseReadiness({
      technical: { packaging: true, consumerInstall: true },
    });
    expect(readiness.publication.license).toBe(true);
    expect(readiness.blockers).not.toContain("release-license-undecided");
    expect(readiness.blockers).toContain("release-repository-metadata-missing");
    expect(readiness.blockers).toContain("publish-access-not-configured");
    expect(readiness.blockers).toContain("first-public-version-undecided");
    expect(readiness.blockers).toContain("security-contact-decision-required");
  });
});
