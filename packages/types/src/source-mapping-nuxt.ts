/**
 * Nuxt static route catalog and source mapping contracts.
 * Implementation lives in `@a11yst/source-mapping-nuxt`.
 */

import type { SourceIndexResult } from "./source-index.js";
import type { VueSourceCatalog, VueSourceMappingEvidence } from "./source-mapping-vue.js";

export type NuxtRouteFileRole = "page" | "parent-page" | "app-shell" | "layout" | "error";

export type NuxtModuleBoundary = "client" | "server" | "unknown";

export type NuxtRouteCatalogOptions = {
  maxRoutes?: number;
  maxFilesPerRoute?: number;
};

export type NuxtRouteSegment =
  | { kind: "static"; value: string }
  | { kind: "dynamic"; name: string }
  | { kind: "optional"; name: string }
  | { kind: "catch-all"; name: string };

export type NuxtRouteEntry = {
  routePattern: string;
  segments: NuxtRouteSegment[];
  pageUris: string[];
  parentPageUris: string[];
  sharedUris: string[];
  layoutUris: string[];
  errorUris: string[];
  scopeIds: string[];
  projectNames?: string[];
  routeGroupNames?: string[];
};

export type NuxtRouteFile = {
  uri: string;
  role: NuxtRouteFileRole;
  routePattern?: string;
  scopeIds: string[];
  projectNames?: string[];
  moduleBoundary: NuxtModuleBoundary;
  routeGroupNames?: string[];
  layoutName?: string;
};

export type NuxtSourceDiagnosticCode =
  | "invalid-nuxt-mapping-evidence"
  | "unsafe-nuxt-route"
  | "unknown-nuxt-scope"
  | "nuxt-project-not-found"
  | "nuxt-page-root-found"
  | "nuxt-route-not-matched"
  | "nuxt-route-ambiguous"
  | "nuxt-route-pattern-conflict"
  | "nuxt-route-limit-reached"
  | "nuxt-route-file-limit-reached"
  | "nuxt-page-source-unsupported"
  | "nuxt-parent-without-page-outlet"
  | "nuxt-layout-not-found"
  | "nuxt-error-page-not-found"
  | "nuxt-vue-file-not-cataloged"
  | "nuxt-source-not-matched"
  | "nuxt-source-ambiguous";

export type NuxtSourceDiagnostic = {
  code: NuxtSourceDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  scopeId?: string;
  routePattern?: string;
  uri?: string;
};

export type NuxtRouteCatalogSummary = {
  scopes: number;
  nuxt3PageRoots: number;
  nuxt4PageRoots: number;
  routes: number;
  staticRoutes: number;
  dynamicRoutes: number;
  optionalRoutes: number;
  catchAllRoutes: number;
  routeGroups: number;
  nestedRoutes: number;
  unsupportedPageFiles: number;
};

export type NuxtRouteCatalog = {
  version: 1;
  status: "complete" | "partial" | "invalid";
  routes: NuxtRouteEntry[];
  files: NuxtRouteFile[];
  diagnostics: NuxtSourceDiagnostic[];
  summary: NuxtRouteCatalogSummary;
};

export type NuxtSourceMappingEvidence = VueSourceMappingEvidence & {
  route?: string;
  fileRole?: "page" | "error";
  layoutName?: string;
  moduleBoundary?: NuxtModuleBoundary;
};

export type NuxtCandidateMetadata = {
  routePattern: string;
  fileRole?: NuxtRouteFileRole;
  layoutName?: string;
  moduleBoundary?: NuxtModuleBoundary;
  routeGroupNames?: string[];
};

export type CreateNuxtRouteCatalogInput = {
  sourceIndex: SourceIndexResult;
  vueCatalog: VueSourceCatalog;
  scopeIds?: string[];
  options?: NuxtRouteCatalogOptions;
};
