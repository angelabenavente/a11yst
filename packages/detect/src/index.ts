/**
 * Static project, framework, and package-manager detection for a11yst.
 *
 * Everything here is read-only and offline: `package.json` is parsed as
 * inert JSON text, config files are only checked for existence, and
 * project code is never imported or executed.
 */

export { detectProject, buildDetectedProject, findNearestPackageRoot, computeIsLibrary } from "./detect-project.js";
export { detectWorkspace } from "./detect-workspace.js";

export { detectPackageManager, LOCKFILE_PRIORITY } from "./package-manager.js";

export {
  detectFramework,
  HOST_PRIORITY,
  SUPPORT_LEVELS,
  type HostFramework,
} from "./frameworks.js";

export {
  detectStaticViteConfigPort,
  parseStaticViteServerPort,
  type ViteConfigPortDetection,
} from "./vite-config-port.js";

export { detectDevServers, buildDevCommand, DEV_SCRIPT_NAMES } from "./scripts.js";

export {
  findWorkspaceRoot,
  discoverWorkspacePackageDirs,
  expandWorkspaceGlob,
  parsePnpmWorkspaceYaml,
  workspacePatternsFromManifest,
  type WorkspaceRootInfo,
} from "./workspace.js";

export {
  readPackageJson,
  listScripts,
  allDependencyNames,
  hasDependency,
  hasAnyDependency,
  packageDisplayName,
  type PackageManifest,
} from "./manifests.js";

export {
  pathExists,
  isRealDirectory,
  readTextFile,
  walkFiles,
  findExistingFile,
  configFileVariants,
  IGNORED_DIRECTORY_NAMES,
  DEFAULT_WALK_MAX_DEPTH,
  type WalkedEntry,
} from "./filesystem.js";

export { sortEvidence, sumWeights } from "./evidence.js";
