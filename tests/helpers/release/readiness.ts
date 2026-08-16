import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  computeRuntimeClosure,
  toMinimalPackageMap,
} from "./package-graph.js";
import {
  findCliPackage,
  getRepoRoot,
  loadWorkspacePackages,
  type LoadedWorkspacePackage,
  type WorkspacePackageManifest,
} from "./workspace-packages.js";

export const RELEASE_BLOCKER_IDS = [
  "release-license-undecided",
  "release-repository-metadata-missing",
  "publish-access-not-configured",
  "version-strategy-provisional",
  "first-public-version-undecided",
  "security-contact-decision-required",
] as const;

export type ReleaseBlockerId = (typeof RELEASE_BLOCKER_IDS)[number];

export type ReleaseReadiness = {
  technical: {
    packaging: boolean;
    consumerInstall: boolean;
  };
  publication: {
    license: boolean;
    repository: boolean;
    publishAccess: boolean;
    versionStrategy: boolean;
    securityContact: boolean;
    firstPublicVersion: boolean;
  };
  blockers: ReleaseBlockerId[];
};

export type ReleaseReadinessInput = {
  repoRoot?: string;
  packages?: LoadedWorkspacePackage[];
  licenseFilePresent?: boolean;
  releaseDocPresent?: boolean;
  releaseDocContent?: string;
  securityDocPresent?: boolean;
  securityDocContent?: string;
  technical?: Partial<ReleaseReadiness["technical"]>;
};

const LICENSE_FILENAMES = ["LICENSE", "LICENSE.md", "LICENSE.txt"] as const;

const PLACEHOLDER_PATTERNS = [
  /example\.com/i,
  /security@example/i,
  /github\.com\/OWNER/i,
  /your-org/i,
  /your-repo/i,
  /CHANGE_ME/i,
  /TODO.*license/i,
  /TBD.*license/i,
];

export async function findLicenseFile(repoRoot: string): Promise<string | undefined> {
  for (const filename of LICENSE_FILENAMES) {
    try {
      await access(join(repoRoot, filename));
      return filename;
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

export function parseSemVer(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);
}

export function collectPublishableManifests(
  packages: LoadedWorkspacePackage[],
): WorkspacePackageManifest[] {
  const cli = findCliPackage(packages);
  if (!cli) {
    return [];
  }
  const map = toMinimalPackageMap(packages);
  const { closure } = computeRuntimeClosure(map, cli.manifest.name);
  return closure
    .map((name) => packages.find((entry) => entry.manifest.name === name)?.manifest)
    .filter((manifest): manifest is WorkspacePackageManifest => Boolean(manifest));
}

export function evaluateLicenseReadiness(
  manifests: WorkspacePackageManifest[],
  licenseFilePresent: boolean,
  licenseContent?: string,
): { ready: boolean; invented: boolean } {
  if (!licenseFilePresent) {
    return { ready: false, invented: false };
  }
  if (
    licenseContent !== undefined &&
    !licenseContent.includes("Mozilla Public License Version 2.0")
  ) {
    return { ready: false, invented: false };
  }
  if (manifests.length === 0) {
    return { ready: false, invented: false };
  }
  const licenses = manifests.map((manifest) => manifest.license).filter(Boolean);
  if (licenses.length !== manifests.length) {
    return { ready: false, invented: false };
  }
  if (!licenses.every((license) => license === "MPL-2.0")) {
    return { ready: false, invented: false };
  }
  return { ready: true, invented: false };
}

export function evaluateRepositoryReadiness(manifests: WorkspacePackageManifest[]): boolean {
  if (manifests.length === 0) {
    return false;
  }
  const repositories = manifests.map((manifest) => manifest.repository);
  if (repositories.some((value) => value === undefined)) {
    return false;
  }
  const serialized = repositories.map((value) => JSON.stringify(value));
  return new Set(serialized).size === 1;
}

export function evaluatePublishAccessReadiness(manifests: WorkspacePackageManifest[]): boolean {
  if (manifests.length === 0) {
    return false;
  }
  return manifests.every((manifest) => manifest.publishConfig?.access === "public");
}

export function evaluateVersionConsistency(manifests: WorkspacePackageManifest[]): boolean {
  if (manifests.length === 0) {
    return false;
  }
  const versions = manifests.map((manifest) => manifest.version);
  if (!versions.every(parseSemVer)) {
    return false;
  }
  return new Set(versions).size === 1;
}

export function evaluateVersionStrategyReadiness(releaseDocContent: string | undefined): boolean {
  if (!releaseDocContent) {
    return false;
  }
  return releaseDocContent.includes("## Versioning") && releaseDocContent.includes("Semantic Versioning");
}

export function evaluateFirstPublicVersionReadiness(releaseDocContent: string | undefined): boolean {
  if (!releaseDocContent) {
    return false;
  }
  if (/First public release version:\*\* decision pending/i.test(releaseDocContent)) {
    return false;
  }
  if (/First public release version:\*\* confirmed/i.test(releaseDocContent)) {
    return true;
  }
  return false;
}

export function hasExplicitSecurityContact(securityDocContent: string | undefined): boolean {
  if (!securityDocContent) {
    return false;
  }
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(securityDocContent))) {
    return false;
  }
  if (/decision required|when that mechanism is available and confirmed/i.test(securityDocContent)) {
    return false;
  }
  if (/Security reporting channel confirmed:/i.test(securityDocContent)) {
    return true;
  }
  if (/mailto:[^\s"']+@[^\s"']+/i.test(securityDocContent) && !/example/i.test(securityDocContent)) {
    return true;
  }
  return false;
}

export function detectInventedLicenseMetadata(manifests: WorkspacePackageManifest[]): boolean {
  return manifests.some(
    (manifest) => manifest.license !== undefined && !manifest.license.trim(),
  );
}

export async function evaluateReleaseReadiness(
  input: ReleaseReadinessInput = {},
): Promise<ReleaseReadiness> {
  const repoRoot = input.repoRoot ?? getRepoRoot();
  const packages = input.packages ?? (await loadWorkspacePackages());
  const manifests = collectPublishableManifests(packages);
  const licenseFilename = await findLicenseFile(repoRoot);
  const licenseFilePresent =
    input.licenseFilePresent ?? Boolean(licenseFilename);
  const licenseContent =
    licenseFilePresent && licenseFilename
      ? await readFile(join(repoRoot, licenseFilename), "utf8")
      : undefined;
  const releaseDocPresent =
    input.releaseDocPresent ??
    (await fileExists(join(repoRoot, "docs", "release.md")));
  const releaseDocContent =
    input.releaseDocContent ??
    (releaseDocPresent ? await readFile(join(repoRoot, "docs", "release.md"), "utf8") : undefined);
  const securityDocPresent =
    input.securityDocPresent ?? (await fileExists(join(repoRoot, "SECURITY.md")));
  const securityDocContent =
    input.securityDocContent ??
    (securityDocPresent ? await readFile(join(repoRoot, "SECURITY.md"), "utf8") : undefined);

  const license = evaluateLicenseReadiness(manifests, licenseFilePresent, licenseContent);
  const repository = evaluateRepositoryReadiness(manifests);
  const publishAccess = evaluatePublishAccessReadiness(manifests);
  const versionStrategy = evaluateVersionStrategyReadiness(releaseDocContent);
  const firstPublicVersion = evaluateFirstPublicVersionReadiness(releaseDocContent);
  const securityContact = hasExplicitSecurityContact(securityDocContent);

  const blockers: ReleaseBlockerId[] = [];
  if (!license.ready) {
    blockers.push("release-license-undecided");
  }
  if (!repository) {
    blockers.push("release-repository-metadata-missing");
  }
  if (!publishAccess) {
    blockers.push("publish-access-not-configured");
  }
  if (!versionStrategy) {
    blockers.push("version-strategy-provisional");
  }
  if (!firstPublicVersion) {
    blockers.push("first-public-version-undecided");
  }
  if (!securityContact) {
    blockers.push("security-contact-decision-required");
  }

  return {
    technical: {
      packaging: input.technical?.packaging ?? true,
      consumerInstall: input.technical?.consumerInstall ?? true,
    },
    publication: {
      license: license.ready,
      repository,
      publishAccess,
      versionStrategy,
      securityContact,
      firstPublicVersion,
    },
    blockers: blockers.sort((left, right) => left.localeCompare(right)),
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function isPublicReleaseReady(readiness: ReleaseReadiness): boolean {
  return readiness.blockers.length === 0;
}
