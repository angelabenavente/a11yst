import type { HtmlSourceDiagnostic, HtmlSourceDiagnosticCode } from "@a11yst/types";

const MESSAGES: Record<HtmlSourceDiagnosticCode, string> = {
  "unsafe-html-source-uri": "HTML source URI is unsafe or escapes the repository",
  "html-file-not-found": "Indexed HTML file was not found",
  "html-file-not-regular": "Indexed HTML path is not a regular file",
  "html-file-read-failed": "Indexed HTML file could not be read",
  "html-parse-warning": "HTML parser reported a recoverable warning",
  "html-element-limit-reached": "Maximum HTML elements per file was reached",
  "html-file-limit-reached": "Maximum HTML catalog files was reached",
  "invalid-html-mapping-evidence": "HTML mapping evidence is invalid or unsafe",
  "unsupported-html-selector": "HTML selector uses unsupported syntax",
  "invalid-html-selector": "HTML selector is invalid",
  "unknown-html-scope": "Requested HTML scope is unknown to the catalog",
  "html-route-not-matched": "Route did not match any HTML file candidate",
  "html-source-not-matched": "No HTML source element matched the evidence",
  "html-source-ambiguous": "Multiple HTML source elements matched the evidence",
  "html-sensitive-value-redacted": "Sensitive HTML value was redacted",
  "html-text-truncated": "HTML text value was truncated",
};

const LEVEL_ORDER: Record<HtmlSourceDiagnostic["level"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function createHtmlDiagnostic(
  code: HtmlSourceDiagnosticCode,
  level: HtmlSourceDiagnostic["level"],
  message?: string,
  uri?: string,
): HtmlSourceDiagnostic {
  const diagnostic: HtmlSourceDiagnostic = {
    code,
    level,
    message: message ?? MESSAGES[code],
  };
  if (uri !== undefined) {
    diagnostic.uri = uri;
  }
  return diagnostic;
}

export function compareHtmlDiagnostics(
  left: HtmlSourceDiagnostic,
  right: HtmlSourceDiagnostic,
): number {
  const levelOrder = LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level];
  if (levelOrder !== 0) {
    return levelOrder;
  }
  const codeOrder = left.code.localeCompare(right.code);
  if (codeOrder !== 0) {
    return codeOrder;
  }
  const uriOrder = (left.uri ?? "").localeCompare(right.uri ?? "");
  if (uriOrder !== 0) {
    return uriOrder;
  }
  return left.message.localeCompare(right.message);
}

export function sortHtmlDiagnostics(diagnostics: HtmlSourceDiagnostic[]): HtmlSourceDiagnostic[] {
  return [...diagnostics].sort(compareHtmlDiagnostics);
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
