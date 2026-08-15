import path from "node:path";
import { normalizeSourceUri, UnsafeSourceUriError } from "@a11yst/source-mapping";
import type { SourceIndexScope } from "@a11yst/types";
import { SourceIndexValidationError } from "./errors.js";

export function assertAbsoluteRepositoryRoot(repositoryRoot: string): void {
  if (typeof repositoryRoot !== "string" || !repositoryRoot.trim()) {
    throw new SourceIndexValidationError(
      "repositoryRoot must be a non-empty string",
      "invalid-repository-root",
    );
  }

  if (!path.isAbsolute(repositoryRoot)) {
    throw new SourceIndexValidationError(
      "repositoryRoot must be an absolute path",
      "invalid-repository-root",
    );
  }
}

export function toRepositoryUri(canonicalRoot: string, absolutePath: string): string | undefined {
  const relative = path.relative(canonicalRoot, absolutePath);
  if (!relative || relative === ".") {
    return undefined;
  }

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }

  const normalizedRelative = relative.split(path.sep).join("/");
  try {
    return normalizeSourceUri(normalizedRelative);
  } catch (error) {
    if (error instanceof UnsafeSourceUriError) {
      return undefined;
    }
    throw error;
  }
}

export function validateScopeRootUri(rootUri: string): string {
  const trimmed = rootUri.trim().replace(/\\/g, "/");
  if (trimmed === "." || trimmed === "./") {
    return ".";
  }

  try {
    return normalizeSourceUri(rootUri);
  } catch (error) {
    if (error instanceof UnsafeSourceUriError) {
      throw new SourceIndexValidationError(
        `Scope root URI is unsafe: ${rootUri}`,
        "unsafe-scope-root",
      );
    }
    throw error;
  }
}

export function resolveScopeAbsolutePath(
  canonicalRoot: string,
  scope: SourceIndexScope,
): string {
  const normalizedRootUri = validateScopeRootUri(scope.rootUri);
  if (normalizedRootUri === ".") {
    return canonicalRoot;
  }
  return path.resolve(canonicalRoot, ...normalizedRootUri.split("/"));
}

export function sortScopes(scopes: SourceIndexScope[]): SourceIndexScope[] {
  return [...scopes].sort((left, right) => {
    const idOrder = left.id.localeCompare(right.id);
    if (idOrder !== 0) {
      return idOrder;
    }
    return left.rootUri.localeCompare(right.rootUri);
  });
}

export function sortStringArray(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
