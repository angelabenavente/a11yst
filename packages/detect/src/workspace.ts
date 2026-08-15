import { lstatSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { IGNORED_DIRECTORY_NAMES, isRealDirectory, pathExists, readTextFile } from "./filesystem.js";
import { readPackageJson, type PackageManifest } from "./manifests.js";

/** Directory depth walked while expanding a trailing `**` glob segment. */
const MAX_RECURSIVE_GLOB_DEPTH = 4;

/**
 * Minimal parser for the `packages:` list in `pnpm-workspace.yaml`.
 * Supports the common forms:
 *
 * ```yaml
 * packages:
 *   - "packages/*"
 *   - apps/*
 * ```
 *
 * and the inline-array form `packages: ["packages/*", "apps/*"]`.
 * This is intentionally not a general YAML parser — only what is needed
 * to read workspace package globs safely, without executing anything.
 */
export function parsePnpmWorkspaceYaml(text: string): string[] {
  const inlineMatch = /^[ \t]*packages[ \t]*:[ \t]*\[(.*)\][ \t]*$/m.exec(text);
  if (inlineMatch?.[1] !== undefined) {
    return inlineMatch[1]
      .split(",")
      .map((item) => stripQuotes(item.trim()))
      .filter((item) => item.length > 0);
  }

  const lines = text.split(/\r?\n/);
  const patterns: string[] = [];
  let inPackagesBlock = false;

  for (const rawLine of lines) {
    const withoutComment = stripTrailingComment(rawLine);

    if (/^[ \t]*packages[ \t]*:[ \t]*$/.test(withoutComment)) {
      inPackagesBlock = true;
      continue;
    }

    if (!inPackagesBlock) {
      continue;
    }

    if (withoutComment.trim().length === 0) {
      continue;
    }

    const itemMatch = /^[ \t]+-[ \t]*(.+?)[ \t]*$/.exec(withoutComment);
    if (itemMatch?.[1] !== undefined) {
      const value = stripQuotes(itemMatch[1].trim());
      if (value.length > 0) {
        patterns.push(value);
      }
      continue;
    }

    // A non-indented, non-list line ends the `packages:` block.
    if (!/^[ \t]/.test(rawLine)) {
      inPackagesBlock = false;
    }
  }

  return patterns;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function stripTrailingComment(line: string): string {
  // Naive but sufficient: pnpm-workspace.yaml globs never contain `#`.
  const hashIndex = line.indexOf("#");
  return hashIndex === -1 ? line : line.slice(0, hashIndex);
}

/** Extract workspace glob patterns from a `package.json` `workspaces` field. */
export function workspacePatternsFromManifest(
  manifest: PackageManifest | undefined,
): string[] | undefined {
  const workspaces = manifest?.workspaces;
  if (Array.isArray(workspaces)) {
    return workspaces;
  }
  if (workspaces && typeof workspaces === "object" && Array.isArray(workspaces.packages)) {
    return workspaces.packages;
  }
  return undefined;
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function segmentToRegExp(segment: string): RegExp {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

function listSubdirectoriesRecursive(root: string, maxDepth: number): string[] {
  const results: string[] = [];

  function visit(dir: string, depth: number): void {
    if (depth > maxDepth) {
      return;
    }
    for (const name of safeReaddir(dir).sort()) {
      if (IGNORED_DIRECTORY_NAMES.has(name)) {
        continue;
      }
      const candidate = join(dir, name);
      let stat;
      try {
        stat = lstatSync(candidate);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        continue;
      }
      results.push(candidate);
      visit(candidate, depth + 1);
    }
  }

  visit(root, 1);
  return results;
}

/**
 * Expand a single workspace glob pattern (e.g. `"packages/*"`, `"apps/**"`)
 * into matching, existing, non-symlinked directories under `workspaceRoot`.
 *
 * Only `*` (one path segment) and `**` (any number of segments, including
 * zero) are supported, which covers every pattern used by real-world
 * `pnpm-workspace.yaml` / package.json `workspaces` fields in practice.
 */
export function expandWorkspaceGlob(workspaceRoot: string, pattern: string): string[] {
  const segments = pattern.split("/").filter((segment) => segment.length > 0);
  let currentDirs = [workspaceRoot];

  for (const segment of segments) {
    const nextDirs: string[] = [];

    if (segment === "**") {
      for (const dir of currentDirs) {
        nextDirs.push(dir, ...listSubdirectoriesRecursive(dir, MAX_RECURSIVE_GLOB_DEPTH));
      }
    } else if (segment.includes("*")) {
      const regex = segmentToRegExp(segment);
      for (const dir of currentDirs) {
        for (const name of safeReaddir(dir).sort()) {
          if (IGNORED_DIRECTORY_NAMES.has(name)) {
            continue;
          }
          const candidate = join(dir, name);
          if (regex.test(name) && isRealDirectory(candidate)) {
            nextDirs.push(candidate);
          }
        }
      }
    } else {
      for (const dir of currentDirs) {
        const candidate = join(dir, segment);
        if (isRealDirectory(candidate)) {
          nextDirs.push(candidate);
        }
      }
    }

    currentDirs = [...new Set(nextDirs)];
  }

  return currentDirs;
}

export interface WorkspaceRootInfo {
  root: string;
  patterns: string[];
  source: "pnpm-workspace.yaml" | "package.json#workspaces";
}

/**
 * Walk up from `cwd` looking for a `pnpm-workspace.yaml` or a
 * `package.json` with a `workspaces` field. Returns `undefined` when
 * neither is found before reaching the filesystem root.
 */
export function findWorkspaceRoot(cwd: string): WorkspaceRootInfo | undefined {
  let current = resolve(cwd);

  while (true) {
    const workspaceYamlText = readTextFile(join(current, "pnpm-workspace.yaml"));
    if (workspaceYamlText !== undefined) {
      return {
        root: current,
        patterns: parsePnpmWorkspaceYaml(workspaceYamlText),
        source: "pnpm-workspace.yaml",
      };
    }

    const manifest = readPackageJson(current);
    const manifestPatterns = workspacePatternsFromManifest(manifest);
    if (manifestPatterns && manifestPatterns.length > 0) {
      return { root: current, patterns: manifestPatterns, source: "package.json#workspaces" };
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

/**
 * Resolve workspace glob patterns (including `!`-prefixed exclusions) into
 * a sorted, de-duplicated list of package directories that contain a
 * `package.json`.
 */
export function discoverWorkspacePackageDirs(
  workspaceRoot: string,
  patterns: readonly string[],
): string[] {
  const included = new Set<string>();
  const excluded = new Set<string>();

  for (const rawPattern of patterns) {
    const isExclusion = rawPattern.startsWith("!");
    const pattern = isExclusion ? rawPattern.slice(1) : rawPattern;
    const matches = expandWorkspaceGlob(workspaceRoot, pattern);

    for (const match of matches) {
      if (isExclusion) {
        excluded.add(match);
      } else {
        included.add(match);
      }
    }
  }

  return [...included]
    .filter((dir) => !excluded.has(dir) && pathExists(join(dir, "package.json")))
    .sort();
}
