export const DEFAULT_MAX_FILES = 5_000;
export const DEFAULT_MAX_ELEMENTS_PER_FILE = 50_000;
export const DEFAULT_MAX_PROPS_PER_ELEMENT = 128;
export const DEFAULT_MAX_TEXT_LENGTH = 256;
export const MAX_SELECTOR_LENGTH = 1024;

export const ALLOWED_PROPS = new Set([
  "id",
  "className",
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
  "aria-hidden",
  "alt",
  "title",
  "name",
  "type",
  "href",
  "htmlFor",
  "tabIndex",
  "disabled",
  "data-testid",
  "data-test",
  "data-cy",
]);

export const EXCLUDED_PROPS = new Set([
  "value",
  "defaultValue",
  "dangerouslySetInnerHTML",
  "style",
  "srcDoc",
  "onClick",
  "onChange",
  "onInput",
  "onSubmit",
  "authorization",
  "token",
  "password",
  "secret",
  "cookie",
]);

export const REACT_INDEX_KINDS = new Set(["jsx", "tsx", "javascript"]);

export const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  /\bpassword\b/i,
  /\btoken\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\bbearer\s+/i,
  /SuperSecret/i,
  /ABC123SECRET/i,
];
