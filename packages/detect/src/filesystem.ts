import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Directories that are never inspected for detection signals.
 * These are generated, vendored, or version-control artefacts.
 */
export const IGNORED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  "out",
  ".turbo",
  ".cache",
]);

/** Default maximum directory depth walked below a project root. */
export const DEFAULT_WALK_MAX_DEPTH = 4;

/**
 * True when a path exists on disk. Uses `lstat` so broken symlinks and
 * symlink targets are treated consistently without ever being dereferenced
 * for content.
 */
export function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/** True when `path` exists and is a real (non-symlink) directory. */
export function isRealDirectory(path: string): boolean {
  try {
    const stat = lstatSync(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read a text file's contents. Returns `undefined` for any failure
 * (missing file, permission error, not a regular file, …) rather than
 * throwing, since detection must degrade gracefully.
 */
export function readTextFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

export interface WalkedEntry {
  /** Absolute path of the entry. */
  absolutePath: string;
  /** Path relative to the walk root, using forward slashes. */
  relativePath: string;
  isDirectory: boolean;
}

/**
 * Enumerate files and directories under `root` up to a limited depth.
 *
 * Safety:
 * - Never follows symlinks (uses `lstat`; symlinked files and directories
 *   are skipped entirely), which also makes this cycle-safe.
 * - Skips well-known build/vendor/VCS directories.
 * - Never reads file contents; callers decide what (if anything) to read.
 */
export function walkFiles(
  root: string,
  options: { maxDepth?: number } = {},
): WalkedEntry[] {
  const maxDepth = options.maxDepth ?? DEFAULT_WALK_MAX_DEPTH;
  const results: WalkedEntry[] = [];

  function visit(dir: string, depth: number): void {
    let entryNames: string[];
    try {
      entryNames = readdirSync(dir);
    } catch {
      return;
    }

    for (const entryName of [...entryNames].sort()) {
      const absolutePath = join(dir, entryName);
      let stat;
      try {
        stat = lstatSync(absolutePath);
      } catch {
        continue;
      }

      if (stat.isSymbolicLink()) {
        continue;
      }

      const relativePath = relative(root, absolutePath).split("\\").join("/");

      if (stat.isDirectory()) {
        if (IGNORED_DIRECTORY_NAMES.has(entryName)) {
          continue;
        }
        results.push({ absolutePath, relativePath, isDirectory: true });
        if (depth < maxDepth) {
          visit(absolutePath, depth + 1);
        }
      } else if (stat.isFile()) {
        results.push({ absolutePath, relativePath, isDirectory: false });
      }
    }
  }

  visit(root, 1);
  return results;
}

/**
 * Find the first existing file directly inside `dir` whose name matches one
 * of `candidates` (checked in order). Only performs existence checks —
 * never reads or evaluates the file.
 */
export function findExistingFile(
  dir: string,
  candidates: readonly string[],
): string | undefined {
  for (const candidate of candidates) {
    const absolutePath = join(dir, candidate);
    if (pathExists(absolutePath)) {
      return candidate;
    }
  }
  return undefined;
}

/** Expand a base filename into its common JS/TS config-file variants. */
export function configFileVariants(
  baseName: string,
  extensions: readonly string[] = ["js", "cjs", "mjs", "ts", "cts", "mts"],
): string[] {
  return extensions.map((ext) => `${baseName}.${ext}`);
}
