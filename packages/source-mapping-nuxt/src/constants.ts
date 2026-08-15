export const DEFAULT_MAX_ROUTES = 10_000;
export const DEFAULT_MAX_FILES_PER_ROUTE = 256;
export const MAX_ROUTE_LENGTH = 2048;

export const VUE_PAGE_EXTENSION = ".vue";
export const UNSUPPORTED_PAGE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

export const APP_SHELL_BASENAMES = new Set(["app.vue"]);
export const ERROR_BASENAMES = new Set(["error.vue"]);
export const DEFAULT_LAYOUT_BASENAME = "default.vue";
