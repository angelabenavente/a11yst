export const DEFAULT_MAX_FILES = 5_000;
export const DEFAULT_MAX_ELEMENTS_PER_FILE = 50_000;
export const DEFAULT_MAX_TEXT_LENGTH = 256;
export const MAX_SELECTOR_LENGTH = 1024;
export const MAX_EVIDENCE_TEXT_LENGTH = 256;

export const ALLOWED_ATTRIBUTES = new Set([
  "id",
  "class",
  "role",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-expanded",
  "aria-selected",
  "aria-checked",
  "aria-pressed",
  "aria-required",
  "aria-invalid",
  "alt",
  "title",
  "name",
  "type",
  "href",
  "for",
  "data-testid",
  "data-test",
  "data-cy",
]);

export const EXCLUDED_CONTENT_TAGS = new Set([
  "script",
  "style",
  "template",
  "noscript",
]);

export const UNSUPPORTED_SELECTOR_PSEUDOS = new Set([
  "hover",
  "focus",
  "active",
  "visited",
  "focus-visible",
  "focus-within",
]);

export const SENSITIVE_ATTRIBUTE_NAMES = new Set([
  "value",
  "srcdoc",
  "style",
  "onclick",
  "onchange",
  "authorization",
  "token",
  "password",
  "secret",
  "cookie",
]);

export const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  /\bpassword\s*[:=]/i,
  /\btoken\s*[:=]/i,
  /\bcookie\s*[:=]/i,
  /\bauthorization\s*[:=]/i,
  /\bbearer\s+/i,
];
