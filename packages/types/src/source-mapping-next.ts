/**
 * Next.js static route catalog and mapping contracts.
 * Implementation lives in `@a11yst/source-mapping-next`.
 */

import type { ReactSourceMappingEvidence } from "./source-mapping-react.js";
import type { SourceMappingNextMetadata } from "./source-mapping.js";

export type NextRouterKind = "app" | "pages";

export type NextRouteFileRole =
  | "page"
  | "layout"
  | "template"
  | "loading"
  | "error"
  | "not-found"
  | "default"
  | "app-shell"
  | "document-shell";

export type NextModuleBoundary = "client" | "server" | "unknown";

export type NextRouteCatalogOptions = {
  maxRoutes?: number;
  maxFilesPerRoute?: number;
};

export type NextRouteSegment =
  | { kind: "static"; value: string }
  | { kind: "dynamic"; name: string }
  | { kind: "catch-all"; name: string }
  | { kind: "optional-catch-all"; name: string };

export type NextRouteEntry = {
  router: NextRouterKind;
  routePattern: string;
  segments: NextRouteSegment[];
  pageUris: string[];
  layoutUris: string[];
  templateUris: string[];
  sharedUris: string[];
  stateUris: Partial<Record<NextRouteFileRole, string[]>>;
  scopeIds: string[];
  projectNames?: string[];
  routeGroupNames?: string[];
};

export type NextRouteFile = {
  uri: string;
  router: NextRouterKind;
  role: NextRouteFileRole;
  routePattern?: string;
  scopeIds: string[];
  projectNames?: string[];
  moduleBoundary: NextModuleBoundary;
  routeGroupNames?: string[];
  parallelSlot?: string;
};

export type NextSourceDiagnosticCode =
  | "invalid-next-mapping-evidence"
  | "unsafe-next-route"
  | "unknown-next-scope"
  | "next-router-not-found"
  | "next-route-not-matched"
  | "next-route-ambiguous"
  | "next-route-pattern-conflict"
  | "next-route-file-limit-reached"
  | "next-route-limit-reached"
  | "next-app-router-root-found"
  | "next-pages-router-root-found"
  | "next-api-route-skipped"
  | "next-route-handler-skipped"
  | "next-intercepting-route-skipped"
  | "next-parallel-slot-required"
  | "next-parallel-slot-not-found"
  | "next-file-role-not-found"
  | "next-react-file-not-cataloged"
  | "next-source-not-matched"
  | "next-source-ambiguous";

export type NextSourceDiagnostic = {
  code: NextSourceDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  scopeId?: string;
  routePattern?: string;
  uri?: string;
};

export type NextRouteCatalogSummary = {
  scopes: number;
  appRouterRoots: number;
  pagesRouterRoots: number;
  routes: number;
  staticRoutes: number;
  dynamicRoutes: number;
  catchAllRoutes: number;
  routeGroups: number;
  parallelRoutes: number;
  interceptingRoutesSkipped: number;
  apiRoutesSkipped: number;
  routeHandlersSkipped: number;
};

export type NextRouteCatalog = {
  version: 1;
  status: "complete" | "partial" | "invalid";
  routes: NextRouteEntry[];
  files: NextRouteFile[];
  diagnostics: NextSourceDiagnostic[];
  summary: NextRouteCatalogSummary;
};

export type NextSourceMappingEvidence = ReactSourceMappingEvidence & {
  route?: string;
  router?: NextRouterKind;
  fileRole?: NextRouteFileRole;
  parallelRouteSlot?: string;
  moduleBoundary?: NextModuleBoundary;
};

export type { SourceMappingNextMetadata as NextCandidateMetadata };
