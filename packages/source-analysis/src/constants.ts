export const DEFAULT_SOURCE_ANALYSIS_OPTIONS = {
  enabled: true,
  ranking: true,
  recommendations: true,
} as const;

export const MAX_SELECTOR_LENGTH = 1024;
export const MAX_TEXT_LENGTH = 256;
export const MAX_ATTRIBUTES = 64;
export const MAX_ATTRIBUTE_VALUE_LENGTH = 256;

export const SUPPORTED_MAPPER_FRAMEWORKS = new Set([
  "html",
  "react",
  "next",
  "vue",
  "nuxt",
  "angular",
]);
