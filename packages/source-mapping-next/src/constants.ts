export const DEFAULT_MAX_ROUTES = 10_000;
export const DEFAULT_MAX_FILES_PER_ROUTE = 256;
export const MAX_ROUTE_LENGTH = 2048;

export const NEXT_FRAMEWORK = "next";

export const APP_ROUTE_ROOT_MARKERS = ["app", "src/app"] as const;
export const PAGES_ROUTE_ROOT_MARKERS = ["pages", "src/pages"] as const;

export const APP_UI_BASENAMES = new Set([
  "page.js",
  "page.jsx",
  "page.tsx",
  "layout.js",
  "layout.jsx",
  "layout.tsx",
  "template.js",
  "template.jsx",
  "template.tsx",
  "loading.js",
  "loading.jsx",
  "loading.tsx",
  "error.js",
  "error.jsx",
  "error.tsx",
  "not-found.js",
  "not-found.jsx",
  "not-found.tsx",
  "default.js",
  "default.jsx",
  "default.tsx",
]);

export const ROUTE_HANDLER_BASENAMES = new Set([
  "route.js",
  "route.jsx",
  "route.ts",
  "route.mjs",
  "route.cjs",
]);

export const REACT_KINDS = new Set(["javascript", "jsx", "tsx"]);

export const STATE_ROLES = new Set(["loading", "error", "not-found", "default"]);

export const INTERCEPTING_PREFIXES = ["(.)", "(..)", "(...)", "(..)(..)"];
