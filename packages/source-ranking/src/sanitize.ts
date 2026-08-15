import type { SourceRankingContext } from "@a11yst/types";
import { normalizeSourceUri, UnsafeSourceUriError } from "@a11yst/source-mapping";
import { MAX_CONTEXT_STRING_LENGTH } from "./constants.js";
import { SourceRankingValidationError } from "./errors.js";

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

function sanitizeContextString(value: string | undefined, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value.includes("\0")) {
    throw new SourceRankingValidationError(`${label} contains null bytes`, "invalid-ranking-context");
  }
  const trimmed = stripControlCharacters(value).trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > MAX_CONTEXT_STRING_LENGTH) {
    return trimmed.slice(0, MAX_CONTEXT_STRING_LENGTH);
  }
  return trimmed;
}

function sanitizePreferredUris(uris: string[] | undefined): string[] | undefined {
  if (uris === undefined) {
    return undefined;
  }
  const normalized: string[] = [];
  for (const uri of uris) {
    try {
      normalized.push(normalizeSourceUri(uri));
    } catch (error) {
      if (error instanceof UnsafeSourceUriError) {
        throw new SourceRankingValidationError("preferred URI is unsafe", "invalid-ranking-context");
      }
      throw error;
    }
  }
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

function sanitizeScopeIds(scopeIds: string[] | undefined): string[] | undefined {
  if (scopeIds === undefined) {
    return undefined;
  }
  const sanitized = scopeIds
    .map((scopeId) => sanitizeContextString(scopeId, "scopeId"))
    .filter((scopeId): scopeId is string => scopeId !== undefined);
  return [...new Set(sanitized)].sort((left, right) => left.localeCompare(right));
}

export function sanitizeRankingContext(context: SourceRankingContext = {}): SourceRankingContext {
  return {
    expectedFramework: sanitizeContextString(context.expectedFramework, "expectedFramework"),
    expectedAdapter: sanitizeContextString(context.expectedAdapter, "expectedAdapter"),
    scopeIds: sanitizeScopeIds(context.scopeIds),
    routePattern: sanitizeContextString(context.routePattern, "routePattern"),
    componentName: sanitizeContextString(context.componentName, "componentName"),
    ownerComponent: sanitizeContextString(context.ownerComponent, "ownerComponent"),
    elementTag: sanitizeContextString(context.elementTag, "elementTag")?.toLowerCase(),
    preferredUris: sanitizePreferredUris(context.preferredUris),
    allowLowConfidenceResolution: context.allowLowConfidenceResolution === true,
  };
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
