import type { AccessibilityRecommendationInput } from "@a11yst/types";
import { isUnsafeAbsolutePath } from "@a11yst/source-mapping";
import {
  MAX_ATTRIBUTES,
  MAX_CHECKPOINT_LENGTH,
  MAX_FLOW_LENGTH,
  MAX_HELP_LENGTH,
  MAX_HELP_URL_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_ROUTE_LENGTH,
  MAX_RULE_ID_LENGTH,
  MAX_SELECTOR_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TEXT_LENGTH,
} from "./constants.js";

const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /\bpassword\b/i,
  /\btoken\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\bbearer\s+/i,
];

function stripControlCharacters(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x1f && code !== 0x7f) {
      result += value[index];
    }
  }
  return result;
}

export function isSensitiveValue(value: string): boolean {
  if (isUnsafeAbsolutePath(value)) {
    return true;
  }
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}

export function sanitizeText(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value.includes("\0")) {
    return undefined;
  }
  const trimmed = stripControlCharacters(value).trim();
  if (!trimmed || isSensitiveValue(trimmed)) {
    return undefined;
  }
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
}

export function sanitizeRuleId(ruleId: string): string | undefined {
  const sanitized = sanitizeText(ruleId, MAX_RULE_ID_LENGTH);
  if (!sanitized || !/^[a-z0-9-]+$/i.test(sanitized)) {
    return undefined;
  }
  return sanitized.toLowerCase();
}

export function sanitizeHelpUrl(helpUrl: string | undefined): string | undefined {
  if (helpUrl === undefined) {
    return undefined;
  }
  const trimmed = stripControlCharacters(helpUrl).trim();
  if (!trimmed || trimmed.length > MAX_HELP_URL_LENGTH) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    if (parsed.username || parsed.password) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function sanitizeInput(
  input: AccessibilityRecommendationInput,
): { input: AccessibilityRecommendationInput; truncated: boolean; sensitive: boolean } {
  let truncated = false;
  let sensitive = false;

  const ruleId = sanitizeRuleId(input.ruleId);
  if (!ruleId) {
    return { input, truncated, sensitive };
  }

  const message = sanitizeText(input.message, MAX_MESSAGE_LENGTH);
  const help = sanitizeText(input.help, MAX_HELP_LENGTH);
  const helpUrl = sanitizeHelpUrl(input.helpUrl);
  if (input.message && !message) {
    sensitive = sensitive || isSensitiveValue(input.message);
  }
  if (input.help && !help) {
    sensitive = sensitive || isSensitiveValue(input.help);
  }

  const tags = input.tags
    ?.map((tag) => sanitizeText(tag, MAX_TAG_LENGTH))
    .filter((tag): tag is string => tag !== undefined)
    .slice(0, MAX_TAGS);
  if (input.tags && (tags?.length ?? 0) < input.tags.length) {
    truncated = true;
  }

  const attributes: Record<string, string | boolean | number> = {};
  if (input.element?.attributes) {
    let count = 0;
    for (const [name, value] of Object.entries(input.element.attributes)) {
      if (count >= MAX_ATTRIBUTES) {
        truncated = true;
        break;
      }
      const lower = name.toLowerCase();
      if (typeof value === "string" && isSensitiveValue(value)) {
        sensitive = true;
        continue;
      }
      attributes[lower] = value;
      count += 1;
    }
  }

  const sanitized: AccessibilityRecommendationInput = {
    ruleId,
    impact: input.impact,
    tags,
    sourceMapping: input.sourceMapping,
    sourceRanking: input.sourceRanking,
  };

  if (message) {
    sanitized.message = message;
  }
  if (help) {
    sanitized.help = help;
  }
  if (helpUrl) {
    sanitized.helpUrl = helpUrl;
  }

  if (input.element) {
    sanitized.element = {
      tagName: sanitizeText(input.element.tagName, MAX_TAG_LENGTH)?.toLowerCase(),
      role: sanitizeText(input.element.role, MAX_TAG_LENGTH)?.toLowerCase(),
      accessibleName: sanitizeText(input.element.accessibleName, MAX_TEXT_LENGTH),
      visibleText: sanitizeText(input.element.visibleText, MAX_TEXT_LENGTH),
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    };
  }

  if (input.context) {
    sanitized.context = {
      framework: sanitizeText(input.context.framework, MAX_TAG_LENGTH)?.toLowerCase(),
      adapter: sanitizeText(input.context.adapter, MAX_TAG_LENGTH)?.toLowerCase(),
      route: sanitizeText(input.context.route, MAX_ROUTE_LENGTH),
      flow: sanitizeText(input.context.flow, MAX_FLOW_LENGTH),
      checkpoint: sanitizeText(input.context.checkpoint, MAX_CHECKPOINT_LENGTH),
      profile: sanitizeText(input.context.profile, MAX_TAG_LENGTH),
      viewport: sanitizeText(input.context.viewport, MAX_TAG_LENGTH),
    };
  }

  return { input: sanitized, truncated, sensitive };
}

export function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => omitUndefinedDeep(entry)) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) {
        result[key] = omitUndefinedDeep(entry);
      }
    }
    return result as T;
  }
  return value;
}

export function sanitizeSelector(selector: string | undefined): string | undefined {
  return sanitizeText(selector, MAX_SELECTOR_LENGTH);
}
