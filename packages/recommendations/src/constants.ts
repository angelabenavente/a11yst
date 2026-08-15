export const MAX_RULE_ID_LENGTH = 128;
export const MAX_MESSAGE_LENGTH = 512;
export const MAX_HELP_LENGTH = 512;
export const MAX_HELP_URL_LENGTH = 2048;
export const MAX_TAGS = 64;
export const MAX_TAG_LENGTH = 128;
export const MAX_SELECTOR_LENGTH = 1024;
export const MAX_ROUTE_LENGTH = 1024;
export const MAX_FLOW_LENGTH = 256;
export const MAX_CHECKPOINT_LENGTH = 256;
export const MAX_TEXT_LENGTH = 256;
export const MAX_ATTRIBUTES = 64;
export const MAX_ACTIONS = 12;
export const MAX_VERIFICATION = 12;
export const MAX_EXAMPLES = 2;
export const MAX_CAVEATS = 12;
export const MAX_TARGET_ALTERNATIVES = 5;
export const MAX_COMBINED_EXAMPLE_LENGTH = 2000;

export const REQUIRED_CAVEATS = [
  "Automated results do not establish WCAG conformance.",
  "Verify the change in the rendered application and with appropriate manual testing.",
] as const;

export const DIAGNOSTIC_LEVEL_ORDER: Record<"error" | "warning" | "info", number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export const DIAGNOSTIC_CODE_ORDER: readonly string[] = [
  "invalid-recommendation-input",
  "invalid-rule-id",
  "unsupported-rule",
  "recommendation-requires-manual-review",
  "invalid-help-url",
  "recommendation-target-conflict",
  "recommendation-target-ambiguous",
  "recommendation-target-unmapped",
  "recommendation-target-invalid",
  "recommendation-target-limit-reached",
  "recommendation-input-truncated",
  "recommendation-sensitive-value-redacted",
  "recommendation-recipe-duplicate",
  "recommendation-alias-conflict",
  "recommendation-action-limit-reached",
  "recommendation-example-limit-reached",
];

export const CONFIDENCE_ORDER: readonly ("exact" | "high" | "medium" | "low")[] = [
  "exact",
  "high",
  "medium",
  "low",
];
