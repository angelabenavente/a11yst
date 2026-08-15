import type {
  Diagnostic,
  DiscoveredRoute,
  NormalizedRoute,
  Platform,
  ResolvedWebProject,
  RouteDiscoveryMode,
  RouteDiscoveryResult,
  RouteOrigin,
  SupportLevel,
  WebFramework,
} from "@a11yst/types";

// Re-export shared contracts from @a11yst/types for convenience.
export type {
  DiscoveredRoute,
  RouteDiscoveryMode,
  RouteDiscoveryResult,
  RouteOrigin,
};

/** Dev-server hint derived from package.json scripts (never executed). */
export interface DevServerRecommendation {
  command?: string;
  url?: string;
  hint?: string;
}

/** Page readiness strategy for browser execution. */
export interface ReadinessStrategy {
  waitUntil: "load" | "domcontentloaded" | "networkidle";
  selectors?: string[];
  timeout?: number;
  settleFrames?: number;
}

/** Context passed to every adapter method. */
export interface AdapterContext {
  projectRoot: string;
  configDir: string;
  project: ResolvedWebProject;
  packageJson?: object;
}

/** Contract implemented by each framework adapter. */
export interface FrameworkAdapter {
  id: string;
  framework: WebFramework;
  supportLevel: SupportLevel;
  appliesTo(project: ResolvedWebProject): boolean;
  recommendDevServer(context: AdapterContext): DevServerRecommendation;
  discoverRoutes(context: AdapterContext): Promise<RouteDiscoveryResult>;
  getReadinessStrategy(context: AdapterContext): ReadinessStrategy;
  getDiagnostics(context: AdapterContext): Promise<Diagnostic[]>;
}

export interface ResolveAdapterInput {
  framework: WebFramework;
  platform: Platform;
}

/** Sample values applied to dynamic route patterns during merge. */
export type RouteSamplesConfig = Record<string, string[]>;

export interface ResolveProjectRoutesInput {
  explicitRoutes: NormalizedRoute[];
  discovery: RouteDiscoveryResult;
  mode: RouteDiscoveryMode;
  samples?: RouteSamplesConfig;
}

export interface ResolveProjectRoutesResult {
  routes: NormalizedRoute[];
  skippedPatterns: RouteDiscoveryResult["skippedPatterns"];
  diagnostics: Diagnostic[];
}
