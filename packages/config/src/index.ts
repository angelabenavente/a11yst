/**
 * Configuration helpers for a11yst.
 *
 * @example
 * ```ts
 * import { defineConfig } from "@a11yst/config";
 *
 * export default defineConfig({
 *   projects: [
 *     {
 *       name: "website",
 *       platform: "web",
 *       framework: "react",
 *       baseUrl: "http://localhost:3000",
 *       routes: ["/"],
 *     },
 *   ],
 * });
 * ```
 */
export { defineConfig } from "./define-config.js";
export {
  CONFIG_FILENAMES,
  DEFAULT_DEV_SERVER_REUSE,
  DEFAULT_DEV_SERVER_TIMEOUT,
  DEFAULT_EVIDENCE,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_PROFILES,
  DEFAULT_READINESS,
  DEFAULT_ROOT_DIR,
  DEFAULT_ROUTE_DISCOVERY,
  DEFAULT_WEB_VIEWPORT,
} from "./defaults.js";
export { ConfigError, type ConfigIssue } from "./errors.js";
export {
  findConfigPath,
  loadConfig,
  resolveProjectPath,
  type LoadConfigOptions,
} from "./load.js";
export {
  generateRouteId,
  humanizeRouteId,
  normalizeBaseUrl,
  normalizeRoutePath,
} from "./normalize.js";
export {
  isAccessibilityProfile,
  normalizeProfileEntries,
  normalizeProfileEntry,
  profileIdsFromOptions,
} from "./profiles.js";
export { validateConfig } from "./validate.js";
