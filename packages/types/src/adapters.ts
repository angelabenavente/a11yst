import type { Diagnostic } from "./config.js";
import type { SupportLevel } from "./enums.js";

export type AdapterId =
  | "generic-web"
  | "html"
  | "react"
  | "next"
  | "angular"
  | "vue"
  | "nuxt";
export type RouteDiscoveryMode = "off" | "fallback" | "merge";
export type RouteOrigin =
  | "explicit"
  | "filesystem"
  | "react-jsx-route"
  | "react-router-object"
  | "adapter-default"
  | "dynamic-sample";

export interface RouteDiscoveryConfig {
  /** Defaults to `"fallback"`. */
  mode?: RouteDiscoveryMode;
  include?: string[];
  exclude?: string[];
  samples?: Record<string, string[]>;
}

export interface ReadinessConfig {
  waitUntil?: "domcontentloaded" | "load";
  selector?: string;
  timeout?: number;
  settleFrames?: number;
}

export interface ResolvedRouteDiscoveryConfig {
  mode: RouteDiscoveryMode;
  include: string[];
  exclude: string[];
  samples: Record<string, string[]>;
}

export interface ResolvedReadinessConfig {
  waitUntil: "domcontentloaded" | "load";
  selector?: string;
  timeout?: number;
  settleFrames?: number;
}

export interface DiscoveredRoute {
  id: string;
  name: string;
  path: string;
  pattern?: string;
  origin: RouteOrigin;
  sourceFile?: string;
  sourceLine?: number;
  dynamic: boolean;
}

export interface SkippedRoutePattern {
  pattern: string;
  reason: string;
  sourceFile?: string;
  sourceLine?: number;
}

export interface RouteDiscoveryUnresolved {
  pattern: string;
  reason: string;
  sourceFile?: string;
  sourceLine?: number;
}

export interface RouteDiscoveryExplain {
  strategy: string;
  routerDetected: boolean;
  routerEvidence: string[];
  fallbackUsed: boolean;
  fallbackReason?: string;
  unresolved: RouteDiscoveryUnresolved[];
}

export interface RouteDiscoveryResult {
  routes: DiscoveredRoute[];
  skippedPatterns: SkippedRoutePattern[];
  diagnostics: Diagnostic[];
  explain?: RouteDiscoveryExplain;
}

export interface AdapterMetadata {
  adapterId: AdapterId;
  framework: string;
  supportLevel: SupportLevel;
}

export interface RunAdapterMetadata extends AdapterMetadata {
  routeOrigin: RouteOrigin;
  routePattern?: string;
  readinessStrategy: string;
}
