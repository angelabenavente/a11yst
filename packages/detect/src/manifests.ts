import { join } from "node:path";
import { readTextFile } from "./filesystem.js";

/**
 * Minimal, defensively-typed shape of a `package.json` file.
 * Only fields relevant to detection are modelled; everything is optional
 * because real-world manifests vary widely and may be malformed.
 */
export interface PackageManifest {
  name?: string;
  version?: string;
  private?: boolean;
  main?: string;
  module?: string;
  types?: string;
  exports?: unknown;
  bin?: unknown;
  type?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

/**
 * Read and JSON-parse `package.json` from `dir` as inert text data.
 * Never imports, requires, or executes the file. Returns `undefined`
 * when the file is missing, unreadable, or not valid JSON.
 */
export function readPackageJson(dir: string): PackageManifest | undefined {
  const text = readTextFile(join(dir, "package.json"));
  if (text === undefined) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as PackageManifest;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Safely read the `scripts` map, defaulting to an empty object. */
export function listScripts(manifest: PackageManifest | undefined): Record<string, string> {
  return manifest?.scripts ?? {};
}

/**
 * Union of dependency names across `dependencies`, `devDependencies`,
 * and `peerDependencies`. Used for framework/tooling evidence only —
 * never for resolving or loading actual packages.
 */
export function allDependencyNames(manifest: PackageManifest | undefined): Set<string> {
  return new Set([
    ...Object.keys(manifest?.dependencies ?? {}),
    ...Object.keys(manifest?.devDependencies ?? {}),
    ...Object.keys(manifest?.peerDependencies ?? {}),
  ]);
}

export function hasDependency(manifest: PackageManifest | undefined, name: string): boolean {
  return allDependencyNames(manifest).has(name);
}

export function hasAnyDependency(
  manifest: PackageManifest | undefined,
  names: readonly string[],
): boolean {
  const deps = allDependencyNames(manifest);
  return names.some((name) => deps.has(name));
}

/**
 * Which manifest section first declares `name`, used only to label
 * detection evidence accurately (never for dependency resolution).
 */
export function dependencyEvidenceType(
  manifest: PackageManifest | undefined,
  name: string,
): "dependency" | "devDependency" | undefined {
  if (manifest?.dependencies && name in manifest.dependencies) {
    return "dependency";
  }
  if (manifest?.devDependencies && name in manifest.devDependencies) {
    return "devDependency";
  }
  if (manifest?.peerDependencies && name in manifest.peerDependencies) {
    return "dependency";
  }
  return undefined;
}

/** Derive a package name from its directory when `package.json` has none. */
export function packageDisplayName(manifest: PackageManifest | undefined, dirName: string): string {
  return manifest?.name?.trim() || dirName;
}
