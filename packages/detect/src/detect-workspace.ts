import { join, resolve } from "node:path";
import type { Diagnostic, WorkspaceDetectionResult } from "@a11yst/types";
import { pathExists } from "./filesystem.js";
import { buildDetectedProject } from "./detect-project.js";
import { readPackageJson } from "./manifests.js";
import { detectPackageManager } from "./package-manager.js";
import { discoverWorkspacePackageDirs, findWorkspaceRoot } from "./workspace.js";

/**
 * Detect every non-library project across a pnpm/npm/yarn workspace.
 *
 * Resolution order:
 * 1. Find a workspace root by walking up from `cwd` looking for
 *    `pnpm-workspace.yaml` or a `package.json` `workspaces` field.
 * 2. Expand the declared glob patterns into candidate package directories.
 * 3. Run project detection on each candidate and keep the ones that don't
 *    look like libraries/tooling packages.
 *
 * When no workspace configuration is found, `cwd` itself is treated as a
 * single-project workspace so the function still returns a useful result.
 */
export async function detectWorkspace(
  options: { cwd?: string } = {},
): Promise<WorkspaceDetectionResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const diagnostics: Diagnostic[] = [];

  const workspaceInfo = findWorkspaceRoot(cwd);
  const workspaceRoot = workspaceInfo?.root ?? cwd;
  const rootManifest = readPackageJson(workspaceRoot);
  const packageManager = detectPackageManager(workspaceRoot, rootManifest);

  let candidateDirs: string[];
  if (workspaceInfo) {
    candidateDirs = discoverWorkspacePackageDirs(workspaceRoot, workspaceInfo.patterns);
    if (candidateDirs.length === 0) {
      diagnostics.push({
        code: "WORKSPACE_NO_PACKAGES_FOUND",
        severity: "warning",
        message: `Found workspace config at ${workspaceRoot} (via ${workspaceInfo.source}), but no package directories matched its patterns.`,
        hint: "Check the workspace glob patterns and confirm matching directories contain a package.json.",
        path: workspaceRoot,
      });
    }
  } else {
    candidateDirs = [];
    diagnostics.push({
      code: "WORKSPACE_CONFIG_NOT_FOUND",
      severity: "info",
      message: `No pnpm-workspace.yaml or package.json "workspaces" field found above ${cwd}; treating it as a single-project workspace.`,
      path: cwd,
    });
  }

  const dirsToInspect = candidateDirs.length > 0 ? candidateDirs : [workspaceRoot];

  const projects = dirsToInspect
    .filter((dir) => pathExists(join(dir, "package.json")))
    .map((dir) => buildDetectedProject(dir, cwd))
    .filter((project) => !project.isLibrary)
    .sort((a, b) => (a.relativeRoot < b.relativeRoot ? -1 : a.relativeRoot > b.relativeRoot ? 1 : 0));

  return {
    cwd,
    workspaceRoot,
    packageManager,
    projects,
    diagnostics,
  };
}
