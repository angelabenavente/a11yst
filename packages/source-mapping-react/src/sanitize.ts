import path from "node:path";
import { normalizeSourceUri, UnsafeSourceUriError } from "@a11yst/source-mapping";
import {
  DEFAULT_MAX_ELEMENTS_PER_FILE,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_PROPS_PER_ELEMENT,
  DEFAULT_MAX_TEXT_LENGTH,
  MAX_SELECTOR_LENGTH,
  SENSITIVE_VALUE_PATTERNS,
} from "./constants.js";
import { ReactSourceValidationError } from "./errors.js";

export function assertAbsoluteRepositoryRoot(repositoryRoot: string): void {
  if (typeof repositoryRoot !== "string" || !repositoryRoot.trim()) {
    throw new ReactSourceValidationError(
      "repositoryRoot must be a non-empty string",
      "invalid-react-mapping-evidence",
    );
  }
  if (!path.isAbsolute(repositoryRoot)) {
    throw new ReactSourceValidationError(
      "repositoryRoot must be an absolute path",
      "invalid-react-mapping-evidence",
    );
  }
}

export function resolveIndexedReactPath(canonicalRoot: string, uri: string): string | undefined {
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

export function resolveReactCatalogOptions(
  options: {
    maxFiles?: number;
    maxElementsPerFile?: number;
    maxPropsPerElement?: number;
    maxTextLength?: number;
  } = {},
) {
  return {
    maxFiles: assertPositiveInteger(options.maxFiles ?? DEFAULT_MAX_FILES, "maxFiles"),
    maxElementsPerFile: assertPositiveInteger(
      options.maxElementsPerFile ?? DEFAULT_MAX_ELEMENTS_PER_FILE,
      "maxElementsPerFile",
    ),
    maxPropsPerElement: assertPositiveInteger(
      options.maxPropsPerElement ?? DEFAULT_MAX_PROPS_PER_ELEMENT,
      "maxPropsPerElement",
    ),
    maxTextLength: assertPositiveInteger(
      options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH,
      "maxTextLength",
    ),
  };
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new ReactSourceValidationError(
      `${label} must be a positive integer`,
      "invalid-react-mapping-evidence",
    );
  }
  return value;
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
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

export function isSensitiveValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

export function sortStringArray(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
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
