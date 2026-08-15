import type { SourceIndexOptions } from "@a11yst/types";
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_FILE_SIZE_BYTES,
} from "./constants.js";
import { SourceIndexValidationError } from "./errors.js";
import { validateScopeRootUri } from "./paths.js";
import { normalizeSourceUri, UnsafeSourceUriError } from "@a11yst/source-mapping";

export type ResolvedSourceIndexOptions = {
  ignorePatterns: string[];
  maxFiles: number;
  maxDepth: number;
  maxFileSizeBytes: number;
};

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new SourceIndexValidationError(
      `${label} must be a positive integer`,
      "invalid-repository-root",
    );
  }
  return value;
}

export function resolveSourceIndexOptions(
  options: SourceIndexOptions = {},
): ResolvedSourceIndexOptions {
  return {
    ignorePatterns: validateIgnorePatterns(options.ignorePatterns ?? []),
    maxFiles: assertPositiveInteger(options.maxFiles ?? DEFAULT_MAX_FILES, "maxFiles"),
    maxDepth: assertPositiveInteger(options.maxDepth ?? DEFAULT_MAX_DEPTH, "maxDepth"),
    maxFileSizeBytes: assertPositiveInteger(
      options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES,
      "maxFileSizeBytes",
    ),
  };
}

export function validateIgnorePatterns(patterns: string[]): string[] {
  const validated: string[] = [];
  for (const pattern of patterns) {
    if (typeof pattern !== "string") {
      throw new SourceIndexValidationError(
        "ignorePatterns must contain strings",
        "invalid-repository-root",
      );
    }
    if (pattern.includes("\0")) {
      throw new SourceIndexValidationError(
        "ignorePatterns cannot contain null bytes",
        "invalid-repository-root",
      );
    }
    const trimmed = pattern.trim();
    if (!trimmed) {
      continue;
    }
    if (pathLooksAbsolute(trimmed)) {
      throw new SourceIndexValidationError(
        "ignorePatterns must be repository-relative",
        "invalid-repository-root",
      );
    }
    try {
      normalizeSourceUri(trimmed.replace(/^\//, ""));
    } catch (error) {
      if (error instanceof UnsafeSourceUriError) {
        throw new SourceIndexValidationError(
          `ignore pattern is unsafe: ${trimmed}`,
          "invalid-repository-root",
        );
      }
      throw error;
    }
    validated.push(trimmed);
  }
  return validated;
}

function pathLooksAbsolute(value: string): boolean {
  return (
    value.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.startsWith("\\\\") ||
    /^file:/i.test(value) ||
    /^https?:\/\//i.test(value)
  );
}

export function validateScopeRoots(scopeRoots: string[]): void {
  for (const rootUri of scopeRoots) {
    validateScopeRootUri(rootUri);
  }
}
