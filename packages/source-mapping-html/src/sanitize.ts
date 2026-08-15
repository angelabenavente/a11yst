import path from "node:path";
import { normalizeSourceUri, UnsafeSourceUriError } from "@a11yst/source-mapping";
import {
  ALLOWED_ATTRIBUTES,
  DEFAULT_MAX_ELEMENTS_PER_FILE,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_TEXT_LENGTH,
  MAX_EVIDENCE_TEXT_LENGTH,
  MAX_SELECTOR_LENGTH,
  SENSITIVE_ATTRIBUTE_NAMES,
  SENSITIVE_VALUE_PATTERNS,
} from "./constants.js";
import { HtmlSourceValidationError } from "./errors.js";

export type ResolvedHtmlCatalogOptions = {
  maxFiles: number;
  maxElementsPerFile: number;
  maxTextLength: number;
};

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new HtmlSourceValidationError(
      `${label} must be a positive integer`,
      "invalid-html-mapping-evidence",
    );
  }
  return value;
}

export function resolveHtmlCatalogOptions(
  options: {
    maxFiles?: number;
    maxElementsPerFile?: number;
    maxTextLength?: number;
  } = {},
): ResolvedHtmlCatalogOptions {
  return {
    maxFiles: assertPositiveInteger(options.maxFiles ?? DEFAULT_MAX_FILES, "maxFiles"),
    maxElementsPerFile: assertPositiveInteger(
      options.maxElementsPerFile ?? DEFAULT_MAX_ELEMENTS_PER_FILE,
      "maxElementsPerFile",
    ),
    maxTextLength: assertPositiveInteger(
      options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH,
      "maxTextLength",
    ),
  };
}

export function assertAbsoluteRepositoryRoot(repositoryRoot: string): void {
  if (typeof repositoryRoot !== "string" || !repositoryRoot.trim()) {
    throw new HtmlSourceValidationError(
      "repositoryRoot must be a non-empty string",
      "invalid-html-mapping-evidence",
    );
  }
  if (!path.isAbsolute(repositoryRoot)) {
    throw new HtmlSourceValidationError(
      "repositoryRoot must be an absolute path",
      "invalid-html-mapping-evidence",
    );
  }
}

export function resolveIndexedHtmlPath(
  canonicalRoot: string,
  uri: string,
): string | undefined {
  try {
    const normalizedUri = normalizeSourceUri(uri);
    const absolutePath = path.resolve(canonicalRoot, ...normalizedUri.split("/"));
    const relative = path.relative(canonicalRoot, absolutePath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      return undefined;
    }
    return absolutePath;
  } catch (error) {
    if (error instanceof UnsafeSourceUriError) {
      return undefined;
    }
    throw error;
  }
}

export function stripControlCharacters(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x1f && code !== 0x7f) {
      result += value[index];
    }
  }
  return result;
}

export function normalizeText(value: string): string {
  return stripControlCharacters(value).replace(/\s+/g, " ").trim();
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

export function isSensitiveValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

export function sanitizeHref(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || /^javascript:/i.test(trimmed) || /^data:/i.test(trimmed)) {
    return undefined;
  }
  if (/^https?:\/\//i.test(trimmed) && trimmed.includes("@")) {
    return undefined;
  }
  if (trimmed.length > 256) {
    return undefined;
  }
  return trimmed;
}

export function filterAllowedAttributes(
  input: Record<string, string>,
): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [name, rawValue] of Object.entries(input)) {
    const lowerName = name.toLowerCase();
    if (!ALLOWED_ATTRIBUTES.has(lowerName) || SENSITIVE_ATTRIBUTE_NAMES.has(lowerName)) {
      continue;
    }
    if (lowerName === "href") {
      const href = sanitizeHref(rawValue);
      if (href !== undefined) {
        filtered[lowerName] = href;
      }
      continue;
    }
    const value = stripControlCharacters(rawValue).trim();
    if (!value || isSensitiveValue(value)) {
      continue;
    }
    filtered[lowerName] = truncateText(value, 256);
  }
  return filtered;
}

export function parseClassNames(classValue: string | undefined): string[] {
  if (!classValue) {
    return [];
  }
  return [...new Set(classValue.split(/\s+/).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function sortStringArray(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function sanitizeEvidenceText(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = normalizeText(value);
  if (!normalized || isSensitiveValue(normalized)) {
    return undefined;
  }
  return truncateText(normalized, maxLength);
}

export function sanitizeEvidenceAttributes(
  attributes: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (attributes === undefined) {
    return undefined;
  }
  const filtered = filterAllowedAttributes(attributes);
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

export function sanitizeSelector(selector: string | undefined): string | undefined {
  if (selector === undefined) {
    return undefined;
  }
  const trimmed = stripControlCharacters(selector).trim();
  if (!trimmed || trimmed.length > MAX_SELECTOR_LENGTH) {
    return undefined;
  }
  return trimmed;
}

export const EVIDENCE_LIMITS = {
  maxSelectorLength: MAX_SELECTOR_LENGTH,
  maxTextLength: MAX_EVIDENCE_TEXT_LENGTH,
};
