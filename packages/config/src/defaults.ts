import type {
  AccessibilityProfile,
  NormalizedViewport,
  ResolvedCiPolicyConfig,
  ResolvedEvidenceConfig,
  ResolvedReadinessConfig,
  ResolvedRouteDiscoveryConfig,
} from "@a11yst/types";

/** Default profile applied when none are specified. */
export const DEFAULT_PROFILES: AccessibilityProfile[] = ["default"];

/** Default desktop viewport for web projects. */
export const DEFAULT_WEB_VIEWPORT: NormalizedViewport = {
  name: "desktop",
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
  orientation: "landscape",
};

/** Default evidence capture behavior. */
export const DEFAULT_EVIDENCE: ResolvedEvidenceConfig = {
  screenshots: true,
  fullPage: false,
};

/** Default CI policy — all gates off, high minimum when enabled later. */
export const DEFAULT_CI_POLICY: ResolvedCiPolicyConfig = {
  failOnNew: false,
  failOnRegression: false,
  failOnExpiredClassification: false,
  minimumSeverity: "high",
};

/** Default source analysis orchestration behavior. */
export const DEFAULT_SOURCE_ANALYSIS = {
  enabled: true,
  ranking: true,
  recommendations: true,
} as const;

/** Default artefacts directory relative to the config file. */
export const DEFAULT_OUTPUT_DIR = ".a11yst/results";

/** Default project root relative to the config file. */
export const DEFAULT_ROOT_DIR = ".";

/** Default whether future engines may reuse an existing server. */
export const DEFAULT_DEV_SERVER_REUSE = true;

/** Default startup timeout for future server launch (ms). */
export const DEFAULT_DEV_SERVER_TIMEOUT = 60_000;

/** Default route discovery behavior for web projects. */
export const DEFAULT_ROUTE_DISCOVERY: ResolvedRouteDiscoveryConfig = {
  mode: "fallback",
  include: [],
  exclude: [],
  samples: {},
};

/** Default page readiness behavior for web audit execution. */
export const DEFAULT_READINESS: ResolvedReadinessConfig = {
  waitUntil: "domcontentloaded",
};

/** Filenames searched when loading configuration. */
export const CONFIG_FILENAMES = [
  "a11yst.config.ts",
  "a11yst.config.mts",
  "a11yst.config.js",
  "a11yst.config.mjs",
] as const;
