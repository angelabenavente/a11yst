import { lstatSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/** Directories skipped during adapter filesystem walks. */
export const ADAPTER_IGNORED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".a11yst",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  "out",
  ".turbo",
  ".cache",
]);

export const ADAPTER_DEFAULT_WALK_MAX_DEPTH = 6;

export interface WalkedEntry {
  absolutePath: string;
  relativePath: string;
  isDirectory: boolean;
}

/**
 * Limited-depth directory walk for adapter route discovery.
 * Never follows symlinks; skips generated and vendor directories.
 */
export function walkFiles(
  root: string,
  options: { maxDepth?: number; ignoredNames?: ReadonlySet<string> } = {},
): WalkedEntry[] {
  const maxDepth = options.maxDepth ?? ADAPTER_DEFAULT_WALK_MAX_DEPTH;
  const ignored = options.ignoredNames ?? ADAPTER_IGNORED_DIRECTORY_NAMES;
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
        if (ignored.has(entryName)) {
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
