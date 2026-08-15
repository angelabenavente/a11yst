/** Directory names excluded from traversal (basename match). */
export const DEFAULT_IGNORED_DIRECTORY_NAMES = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  "out",
  ".turbo",
  ".cache",
  ".vite",
  ".expo",
  "playwright-report",
  "test-results",
] as const;

/** Relative path prefixes excluded even when nested (repository-relative). */
export const DEFAULT_IGNORED_DIRECTORY_PREFIXES = [".a11yst/results"] as const;

export const GENERATED_FILE_PATTERNS: readonly RegExp[] = [
  /\.d\.ts$/i,
  /\.d\.mts$/i,
  /\.d\.cts$/i,
  /\.map$/i,
  /\.min\.js$/i,
  /\.min\.mjs$/i,
  /\.min\.cjs$/i,
  /\.bundle\.js$/i,
  /\.bundle\.mjs$/i,
  /\.bundle\.cjs$/i,
];

export const DEFAULT_MAX_FILES = 50_000;
export const DEFAULT_MAX_DEPTH = 64;
export const DEFAULT_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export const DEFAULT_SCOPE = {
  id: "repository",
  rootUri: ".",
} as const;
