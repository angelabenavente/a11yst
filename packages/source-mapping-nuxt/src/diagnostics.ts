import type { NuxtSourceDiagnostic, NuxtSourceDiagnosticCode } from "@a11yst/types";

const DIAGNOSTIC_MESSAGES: Record<NuxtSourceDiagnosticCode, string> = {
  "invalid-nuxt-mapping-evidence": "Nuxt mapping evidence is invalid",
  "unsafe-nuxt-route": "Nuxt route is unsafe",
  "unknown-nuxt-scope": "Nuxt scope is unknown",
  "nuxt-project-not-found": "Nuxt project was not found",
  "nuxt-page-root-found": "Nuxt page root was found",
  "nuxt-route-not-matched": "Nuxt route was not matched",
  "nuxt-route-ambiguous": "Nuxt route resolution is ambiguous",
  "nuxt-route-pattern-conflict": "Nuxt route pattern conflict",
  "nuxt-route-limit-reached": "Nuxt route limit reached",
  "nuxt-route-file-limit-reached": "Nuxt route file limit reached",
  "nuxt-page-source-unsupported": "Nuxt page source extension is unsupported",
  "nuxt-parent-without-page-outlet": "Nuxt parent page has no page outlet",
  "nuxt-layout-not-found": "Nuxt layout was not found",
  "nuxt-error-page-not-found": "Nuxt error page was not found",
  "nuxt-vue-file-not-cataloged": "Nuxt Vue file was not cataloged",
  "nuxt-source-not-matched": "Nuxt source was not matched",
  "nuxt-source-ambiguous": "Nuxt source mapping is ambiguous",
};

export function createNuxtDiagnostic(
  code: NuxtSourceDiagnosticCode,
  level: NuxtSourceDiagnostic["level"],
  message?: string,
  extras?: { scopeId?: string; routePattern?: string; uri?: string },
): NuxtSourceDiagnostic {
  const diagnostic: NuxtSourceDiagnostic = {
    code,
    level,
    message: message ?? DIAGNOSTIC_MESSAGES[code],
  };
  if (extras?.scopeId) {
    diagnostic.scopeId = extras.scopeId;
  }
  if (extras?.routePattern) {
    diagnostic.routePattern = extras.routePattern;
  }
  if (extras?.uri) {
    diagnostic.uri = extras.uri;
  }
  return diagnostic;
}

export function sortNuxtDiagnostics(diagnostics: NuxtSourceDiagnostic[]): NuxtSourceDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const levelOrder = { error: 0, warning: 1, info: 2 };
    const levelDiff = levelOrder[left.level] - levelOrder[right.level];
    if (levelDiff !== 0) {
      return levelDiff;
    }
    const codeDiff = left.code.localeCompare(right.code);
    if (codeDiff !== 0) {
      return codeDiff;
    }
    const scopeDiff = (left.scopeId ?? "").localeCompare(right.scopeId ?? "");
    if (scopeDiff !== 0) {
      return scopeDiff;
    }
    const routeDiff = (left.routePattern ?? "").localeCompare(right.routePattern ?? "");
    if (routeDiff !== 0) {
      return routeDiff;
    }
    const uriDiff = (left.uri ?? "").localeCompare(right.uri ?? "");
    if (uriDiff !== 0) {
      return uriDiff;
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
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) {
        result[key] = omitUndefinedDeep(entry);
      }
    }
    return result as T;
  }
  return value;
}
