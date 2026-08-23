import { describe, expect, it } from "vitest";
import {
  evaluateFirstPublicVersionReadiness,
  evaluateLicenseReadiness,
  evaluatePublishAccessReadiness,
  evaluateReleaseReadiness,
  evaluateRepositoryReadiness,
  evaluateVersionConsistency,
  evaluateVersionStrategyReadiness,
  hasExplicitSecurityContact,
  isPublicReleaseReady,
} from "../../helpers/release/readiness.js";
import type { WorkspacePackageManifest } from "../../helpers/release/workspace-packages.js";

const SAMPLE_MANIFESTS: WorkspacePackageManifest[] = [
  { name: "@a11yst/types", version: "1.0.0", license: "MPL-2.0", files: ["dist", "LICENSE"] },
  {
    name: "@a11yst/cli",
    version: "1.0.0",
    license: "MPL-2.0",
    files: ["dist", "README.md", "LICENSE", "NOTICE.md", "TRADEMARKS.md"],
  },
];

describe("release readiness evaluator", () => {
  it("reports the current repository ready for public release", async () => {
    const readiness = await evaluateReleaseReadiness({
      technical: { packaging: true, consumerInstall: true },
    });

    expect(readiness.technical.packaging).toBe(true);
    expect(readiness.technical.consumerInstall).toBe(true);
    expect(readiness.publication.license).toBe(true);
    expect(readiness.publication.repository).toBe(true);
    expect(readiness.publication.publishAccess).toBe(true);
    expect(readiness.publication.versionStrategy).toBe(true);
    expect(readiness.publication.firstPublicVersion).toBe(true);
    expect(readiness.publication.securityContact).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(isPublicReleaseReady(readiness)).toBe(true);
  });

  it("returns zero publication blockers for a synthetic ready fixture", async () => {
    const manifests: WorkspacePackageManifest[] = [
      {
        name: "@a11yst/types",
        version: "1.0.0",
        license: "MPL-2.0",
        repository: { type: "git", url: "https://example.org/a11yst.git" },
        publishConfig: { access: "public" },
        files: ["dist", "LICENSE"],
      },
      {
        name: "@a11yst/cli",
        version: "1.0.0",
        license: "MPL-2.0",
        repository: { type: "git", url: "https://example.org/a11yst.git" },
        publishConfig: { access: "public" },
        files: ["dist", "README.md", "LICENSE", "NOTICE.md", "TRADEMARKS.md"],
        bin: { a11yst: "./dist/bin.js" },
        dependencies: { "@a11yst/types": "1.0.0" },
      },
    ];

    const readiness = await evaluateReleaseReadiness({
      packages: manifests.map((manifest, index) => ({
        dirRelative: `packages/${index}`,
        dirAbsolute: `/tmp/packages/${index}`,
        manifest,
      })),
      licenseFilePresent: true,
      releaseDocPresent: true,
      releaseDocContent: [
        "## Versioning",
        "Semantic Versioning",
        "**First public release version:** confirmed 1.0.0",
      ].join("\n"),
      securityDocPresent: true,
      securityDocContent: "Security reporting channel confirmed: mailto:security@a11yst.test",
      technical: { packaging: true, consumerInstall: true },
    });

    expect(readiness.blockers).toEqual([]);
    expect(isPublicReleaseReady(readiness)).toBe(true);
  });

  it("detects missing-license fixture blocker", () => {
    const result = evaluateLicenseReadiness(SAMPLE_MANIFESTS, false);
    expect(result.ready).toBe(false);
  });

  it("requires MPL-2.0 specifically when license metadata is present", () => {
    expect(
      evaluateLicenseReadiness(
        [{ name: "@a11yst/types", version: "1.0.0", license: "MIT" }],
        true,
        "Mozilla Public License Version 2.0",
      ).ready,
    ).toBe(false);
    expect(
      evaluateLicenseReadiness(
        [{ name: "@a11yst/types", version: "1.0.0", license: "MPL-2.0" }],
        true,
        "Mozilla Public License Version 2.0",
      ).ready,
    ).toBe(true);
  });

  it("detects missing-repository fixture blocker", () => {
    expect(evaluateRepositoryReadiness(SAMPLE_MANIFESTS)).toBe(false);
  });

  it("detects missing-publish-access fixture blocker", () => {
    expect(evaluatePublishAccessReadiness(SAMPLE_MANIFESTS)).toBe(false);
  });

  it("detects version mismatch fixture blocker", () => {
    expect(
      evaluateVersionConsistency([
        { name: "@a11yst/types", version: "1.0.0" },
        { name: "@a11yst/cli", version: "0.2.0" },
      ]),
    ).toBe(false);
  });

  it("treats provisional first-public-version docs as undecided", () => {
    expect(
      evaluateFirstPublicVersionReadiness(
        "**First public release version:** decision pending",
      ),
    ).toBe(false);
  });

  it("accepts confirmed version strategy documentation", () => {
    expect(
      evaluateVersionStrategyReadiness("## Versioning\nSemantic Versioning"),
    ).toBe(true);
  });

  it("rejects placeholder security contacts", () => {
    expect(hasExplicitSecurityContact("Contact security@example.com")).toBe(false);
    expect(
      hasExplicitSecurityContact(
        "Use the private security reporting mechanism when that mechanism is available and confirmed",
      ),
    ).toBe(false);
    expect(
      hasExplicitSecurityContact("Security reporting channel confirmed: mailto:security@a11yst.test"),
    ).toBe(true);
    expect(hasExplicitSecurityContact("Security reporting channel confirmed: none.")).toBe(true);
  });
});
