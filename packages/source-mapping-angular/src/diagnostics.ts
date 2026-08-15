import type { AngularSourceDiagnostic, AngularSourceDiagnosticCode } from "@a11yst/types";

const MESSAGES: Record<AngularSourceDiagnosticCode, string> = {
  "unsafe-angular-source-uri": "Angular source URI is unsafe",
  "angular-typescript-file-not-found": "Angular TypeScript file was not found",
  "angular-typescript-file-not-regular": "Angular TypeScript path is not a regular file",
  "angular-typescript-read-failed": "Angular TypeScript file could not be read",
  "angular-typescript-parse-failed": "Angular TypeScript parse failed",
  "angular-component-metadata-dynamic": "Angular component metadata is dynamic",
  "angular-component-selector-dynamic": "Angular component selector is dynamic",
  "angular-component-selector-unsupported": "Angular component selector is unsupported",
  "angular-template-missing": "Angular component has no static template",
  "angular-template-dynamic": "Angular template metadata is dynamic",
  "angular-template-url-dynamic": "Angular templateUrl is dynamic",
  "angular-template-url-unsafe": "Angular templateUrl is unsafe",
  "angular-template-not-indexed": "Angular template is not indexed",
  "angular-template-file-not-found": "Angular template file was not found",
  "angular-template-file-not-regular": "Angular template path is not a regular file",
  "angular-template-read-failed": "Angular template file could not be read",
  "angular-template-parse-warning": "Angular template parse warning",
  "angular-template-parse-failed": "Angular template parse failed",
  "angular-inline-template-location-unsupported": "Angular inline template location is unsupported",
  "angular-component-limit-reached": "Angular component limit reached",
  "angular-template-limit-reached": "Angular template limit reached",
  "angular-element-limit-reached": "Angular element limit reached",
  "angular-attribute-limit-reached": "Angular attribute limit reached",
  "angular-dynamic-binding": "Angular dynamic binding detected",
  "angular-event-binding": "Angular event binding detected",
  "angular-two-way-binding": "Angular two-way binding detected",
  "angular-structural-directive": "Angular structural directive detected",
  "angular-content-projection-unresolved": "Angular content projection is unresolved",
  "invalid-angular-mapping-evidence": "Angular mapping evidence is invalid",
  "unsupported-angular-selector": "Angular selector is unsupported",
  "invalid-angular-selector": "Angular selector is invalid",
  "unknown-angular-scope": "Angular scope is unknown",
  "angular-source-not-matched": "Angular source was not matched",
  "angular-source-ambiguous": "Angular source mapping is ambiguous",
  "angular-sensitive-value-redacted": "Sensitive Angular value was redacted",
  "angular-text-truncated": "Angular static text was truncated",
};

export function createAngularDiagnostic(
  code: AngularSourceDiagnosticCode,
  level: AngularSourceDiagnostic["level"],
  uri?: string,
  componentName?: string,
): AngularSourceDiagnostic {
  const diagnostic: AngularSourceDiagnostic = { code, level, message: MESSAGES[code] };
  if (uri !== undefined) {
    diagnostic.uri = uri;
  }
  if (componentName !== undefined) {
    diagnostic.componentName = componentName;
  }
  return diagnostic;
}

export function sortAngularDiagnostics(diagnostics: AngularSourceDiagnostic[]): AngularSourceDiagnostic[] {
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
    const uriDiff = (left.uri ?? "").localeCompare(right.uri ?? "");
    if (uriDiff !== 0) {
      return uriDiff;
    }
    const componentDiff = (left.componentName ?? "").localeCompare(right.componentName ?? "");
    if (componentDiff !== 0) {
      return componentDiff;
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
