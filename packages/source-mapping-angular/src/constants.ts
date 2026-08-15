export const DEFAULT_MAX_TYPESCRIPT_FILES = 10_000;
export const DEFAULT_MAX_TEMPLATE_FILES = 5_000;
export const DEFAULT_MAX_COMPONENTS = 10_000;
export const DEFAULT_MAX_ELEMENTS_PER_TEMPLATE = 50_000;
export const DEFAULT_MAX_ATTRIBUTES_PER_ELEMENT = 128;
export const DEFAULT_MAX_TEXT_LENGTH = 256;
export const MAX_SELECTOR_LENGTH = 1024;

export const TS_INDEX_KIND = "typescript" as const;
export const TEMPLATE_INDEX_KIND = "angular-template" as const;

export const STRUCTURAL_TAGS = new Set(["ng-container", "ng-template", "ng-content"]);

export const ALLOWED_STATIC_ATTRIBUTES = new Set([
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
  "aria-hidden",
  "alt",
  "title",
  "name",
  "type",
  "href",
  "for",
  "tabindex",
  "disabled",
  "data-testid",
  "data-test",
  "data-cy",
]);

export const EXCLUDED_ATTRIBUTES = new Set([
  "value",
  "style",
  "srcdoc",
  "innerhtml",
  "outerhtml",
  "ngmodel",
]);

export const ACCESSIBLE_NAME_TAGS = new Set(["button", "a", "label", "input"]);

export const SENSITIVE_VALUE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /bearer\s+/i,
];

export const BOOLEAN_ATTRIBUTES = new Set(["disabled", "readonly", "required", "checked", "selected"]);
