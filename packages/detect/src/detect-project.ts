import { basename, dirname, join, relative, resolve } from "node:path";
import type { DetectedProject, Diagnostic, ProjectDetectionResult } from "@a11yst/types";
import { DEFAULT_WALK_MAX_DEPTH, pathExists, walkFiles } from "./filesystem.js";
import { detectFramework } from "./frameworks.js";
import { listScripts, packageDisplayName, readPackageJson, type PackageManifest } from "./manifests.js";
import { detectPackageManager } from "./package-manager.js";
import { detectDevServers } from "./scripts.js";

/** Script names that mark a package as a runnable app rather than a library. */
const APP_SCRIPT_NAMES: readonly string[] = ["dev", "start", "serve", "develop"];

function hasAppScript(manifest: PackageManifest | undefined): boolean {
  const scripts = listScripts(manifest);
  return APP_SCRIPT_NAMES.some(
    (name) => typeof scripts[name] === "string" && scripts[name]!.trim().length > 0,
  );
}

/**
 * Heuristic library classification, evaluated only when no dev/start/serve
 * script exists and no framework was detected: a package that exposes a
 * `main`/`module`/`exports`/`types` surface, or uses an `@scope/name`,
 * looks like a library, types package, or CLI/config tool rather than an
 * auditable app.
 */
export function computeIsLibrary(
  manifest: PackageManifest | undefined,
  framework: DetectedProject["framework"],
): boolean {
  if (!manifest) {
    return false;
  }
  if (hasAppScript(manifest)) {
    return false;
  }
  if (framework.framework !== "unknown") {
    return false;
  }

  const hasLibrarySurface = Boolean(
    manifest.main || manifest.module || manifest.exports || manifest.types,
  );
  const isScopedName = typeof manifest.name === "string" && manifest.name.startsWith("@");

  return hasLibrarySurface || isScopedName;
}

function toRelative(cwd: string, target: string): string {
  const rel = relative(cwd, target);
  const normalized = rel.length === 0 ? "." : rel;
  return normalized.split("\\").join("/");
}

/**
 * Run every static detector against a single, already-known project root
 * and assemble a `DetectedProject`. Shared by both `detectProject` (single
 * project) and `detectWorkspace` (one call per discovered package).
 */
export function buildDetectedProject(rootDir: string, cwd: string): DetectedProject {
  const manifest = readPackageJson(rootDir);
  const entries = walkFiles(rootDir, { maxDepth: DEFAULT_WALK_MAX_DEPTH });

  const framework = detectFramework(rootDir, manifest, entries);
  const packageManager = detectPackageManager(rootDir, manifest);
  const { devServers, diagnostics: devServerDiagnostics } = detectDevServers(
    rootDir,
    manifest,
    packageManager.name,
    framework.framework,
  );
  const isLibrary = computeIsLibrary(manifest, framework);
  const name = packageDisplayName(manifest, basename(rootDir));

  const diagnostics: Diagnostic[] = [...devServerDiagnostics];
  if (!manifest) {
    diagnostics.push({
      code: "PACKAGE_JSON_NOT_FOUND",
      severity: "warning",
      message: `No package.json found at ${rootDir}.`,
      path: rootDir,
    });
  }

  return {
    rootDir,
    relativeRoot: toRelative(cwd, rootDir),
    name,
    framework,
    packageManager,
    devServers,
    isLibrary,
    diagnostics,
  };
}

/**
 * Walk up from `cwd` (a bounded number of levels) to find the nearest
 * directory containing a `package.json`. Falls back to `cwd` itself when
 * none is found, so detection always degrades gracefully.
 */
export function findNearestPackageRoot(cwd: string, maxLevels = 5): string {
  let current = resolve(cwd);

  for (let level = 0; level <= maxLevels; level += 1) {
    if (pathExists(join(current, "package.json"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return resolve(cwd);
}

/**
 * Detect the single project rooted at (or above) `options.cwd`.
 *
 * This never executes project code: it only reads `package.json` as JSON
 * text and checks for the existence of well-known config files/directories.
 */
export async function detectProject(
  options: { cwd?: string } = {},
): Promise<ProjectDetectionResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const rootDir = findNearestPackageRoot(cwd);
  const project = buildDetectedProject(rootDir, cwd);

  const diagnostics: Diagnostic[] = [];
  if (rootDir !== cwd) {
    diagnostics.push({
      code: "PROJECT_ROOT_RESOLVED",
      severity: "info",
      message: `Resolved project root to ${rootDir} (nearest package.json found above ${cwd}).`,
      path: rootDir,
    });
  }

  return { cwd, rootDir, project, diagnostics };
}
