export const DEFAULT_MAX_FILES = 5_000;
export const DEFAULT_MAX_ELEMENTS_PER_FILE = 50_000;
export const DEFAULT_MAX_ATTRIBUTES_PER_ELEMENT = 128;
export const DEFAULT_MAX_TEXT_LENGTH = 256;
export const MAX_SELECTOR_LENGTH = 1024;
export const MAX_COMPONENT_NAME_LENGTH = 256;
export const MAX_CLASS_TOKEN_LENGTH = 128;

export const VUE_INDEX_KIND = "vue" as const;

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

export const EXCLUDED_ATTRIBUTE_NAMES = new Set([
  "value",
  "style",
  "srcdoc",
  "v-html",
  "v-model",
  "on",
  "onclick",
]);

export const STRUCTURAL_TAGS = new Set([
  "template",
  "slot",
  "component",
  "teleport",
  "transition",
  "transition-group",
  "keep-alive",
  "suspense",
  "nuxtlink",
  "nuxtpage",
  "nuxtlayout",
  "router-link",
  "router-view",
]);

export const SENSITIVE_VALUE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /bearer\s+/i,
];

export const ACCESSIBLE_NAME_TAGS = new Set(["button", "a", "label", "input"]);
