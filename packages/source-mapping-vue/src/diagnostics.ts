import type { VueSourceDiagnostic, VueSourceDiagnosticCode } from "@a11yst/types";

const DIAGNOSTIC_MESSAGES: Record<VueSourceDiagnosticCode, string> = {
  "unsafe-vue-source-uri": "Vue source URI is unsafe",
  "vue-file-not-found": "Vue source file was not found",
  "vue-file-not-regular": "Vue source path is not a regular file",
  "vue-file-read-failed": "Vue source file could not be read",
  "vue-sfc-parse-warning": "Vue SFC parse warning",
  "vue-sfc-parse-failed": "Vue SFC parse failed",
  "vue-template-missing": "Vue SFC has no template block",
  "vue-template-language-unsupported": "Vue template language is unsupported",
  "vue-external-template-unsupported": "External Vue templates are unsupported",
  "vue-template-parse-warning": "Vue template parse warning",
  "vue-file-limit-reached": "Vue catalog file limit reached",
  "vue-element-limit-reached": "Vue catalog element limit reached",
  "vue-attribute-limit-reached": "Vue catalog attribute limit reached",
  "vue-dynamic-binding": "Vue dynamic binding detected",
  "vue-spread-binding": "Vue spread binding detected",
  "invalid-vue-mapping-evidence": "Vue mapping evidence is invalid",
  "unsupported-vue-selector": "Vue selector is unsupported",
  "invalid-vue-selector": "Vue selector is invalid",
  "unknown-vue-scope": "Vue scope is unknown",
  "vue-source-not-matched": "Vue source was not matched",
  "vue-source-ambiguous": "Vue source mapping is ambiguous",
  "vue-sensitive-value-redacted": "Sensitive Vue value was redacted",
  "vue-text-truncated": "Vue static text was truncated",
};

export function createVueDiagnostic(
  code: VueSourceDiagnosticCode,
  level: VueSourceDiagnostic["level"],
  uri?: string,
): VueSourceDiagnostic {
  const diagnostic: VueSourceDiagnostic = {
    code,
    level,
    message: DIAGNOSTIC_MESSAGES[code],
  };
  if (uri !== undefined) {
    diagnostic.uri = uri;
  }
  return diagnostic;
}

export function sortVueDiagnostics(diagnostics: VueSourceDiagnostic[]): VueSourceDiagnostic[] {
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
