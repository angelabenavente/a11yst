import type { NextSourceDiagnostic, NextSourceDiagnosticCode } from "@a11yst/types";

const LEVEL_ORDER: Record<NextSourceDiagnostic["level"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function createNextDiagnostic(
  code: NextSourceDiagnosticCode,
  level: NextSourceDiagnostic["level"],
  message: string,
  fields?: { scopeId?: string; routePattern?: string; uri?: string },
): NextSourceDiagnostic {
  const diagnostic: NextSourceDiagnostic = { code, level, message };
  if (fields?.scopeId !== undefined) {
    diagnostic.scopeId = fields.scopeId;
  }
  if (fields?.routePattern !== undefined) {
    diagnostic.routePattern = fields.routePattern;
  }
  if (fields?.uri !== undefined) {
    diagnostic.uri = fields.uri;
  }
  return diagnostic;
}

export function sortNextDiagnostics(diagnostics: NextSourceDiagnostic[]): NextSourceDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const levelOrder = LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level];
    if (levelOrder !== 0) {
      return levelOrder;
    }
    const codeOrder = left.code.localeCompare(right.code);
    if (codeOrder !== 0) {
      return codeOrder;
    }
    const scopeOrder = (left.scopeId ?? "").localeCompare(right.scopeId ?? "");
    if (scopeOrder !== 0) {
      return scopeOrder;
    }
    const routeOrder = (left.routePattern ?? "").localeCompare(right.routePattern ?? "");
    if (routeOrder !== 0) {
      return routeOrder;
    }
    const uriOrder = (left.uri ?? "").localeCompare(right.uri ?? "");
    if (uriOrder !== 0) {
      return uriOrder;
    }
    return left.message.localeCompare(right.message);
  });
}

export function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => omitUndefinedDeep(entry)) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        result[key] = omitUndefinedDeep(entry);
      }
    }
    return result as T;
  }
  return value;
}
