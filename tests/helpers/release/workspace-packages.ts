import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type WorkspacePackageManifest = {
  name: string;
  version: string;
  private?: boolean;
  description?: string;
  type?: string;
  main?: string;
  module?: string;
  types?: string;
  exports?: unknown;
  bin?: Record<string, string>;
  files?: string[];
  engines?: { node?: string };
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  publishConfig?: { access?: string };
  license?: string;
  keywords?: string[];
  repository?: unknown;
  homepage?: string;
};

export type LoadedWorkspacePackage = {
  dirRelative: string;
  dirAbsolute: string;
  manifest: WorkspacePackageManifest;
};

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

export function getRepoRoot(): string {
  return repoRoot;
}

export async function loadWorkspacePackages(
  packagesRoot = join(repoRoot, "packages"),
): Promise<LoadedWorkspacePackage[]> {
  const entries = await readdir(packagesRoot, { withFileTypes: true });
  const packages: LoadedWorkspacePackage[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const dirAbsolute = join(packagesRoot, entry.name);
    const manifestPath = join(dirAbsolute, "package.json");
    const raw = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as WorkspacePackageManifest;
    packages.push({
      dirRelative: `packages/${entry.name}`,
      dirAbsolute,
      manifest,
    });
  }

  return packages.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

export function buildPackageMap(
  packages: LoadedWorkspacePackage[],
): Map<string, LoadedWorkspacePackage> {
  return new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));
}

export function findCliPackage(
  packages: LoadedWorkspacePackage[],
): LoadedWorkspacePackage | undefined {
  return packages.find((pkg) => pkg.manifest.bin && "a11yst" in pkg.manifest.bin);
}

export function isWorkspaceDependencyRange(range: string): boolean {
  return range.startsWith("workspace:");
}

export function isWorkspacePackageName(
  dependencyName: string,
  packageMap: Map<string, { name: string }>,
): boolean {
  return packageMap.has(dependencyName);
}
