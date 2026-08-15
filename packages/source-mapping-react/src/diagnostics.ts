import type { ReactSourceDiagnostic, ReactSourceDiagnosticCode } from "@a11yst/types";

const MESSAGES: Record<ReactSourceDiagnosticCode, string> = {
  "unsafe-react-source-uri": "React source URI is unsafe or escapes the repository",
  "react-file-not-found": "Indexed React file was not found",
  "react-file-not-regular": "Indexed React path is not a regular file",
  "react-file-read-failed": "Indexed React file could not be read",
  "react-parse-warning": "React parser reported a recoverable warning",
  "react-parse-failed": "React file could not be parsed",
  "react-file-limit-reached": "Maximum React catalog files was reached",
  "react-element-limit-reached": "Maximum React elements per file was reached",
  "react-prop-limit-reached": "Maximum React props per element was reached",
  "react-file-without-jsx": "JavaScript file did not contain JSX",
  "react-dynamic-prop": "Dynamic React prop was not evaluated",
  "react-spread-props": "React spread props introduce uncertainty",
  "react-fragment-ignored": "React fragment was ignored",
  "invalid-react-mapping-evidence": "React mapping evidence is invalid or unsafe",
  "unsupported-react-selector": "React selector uses unsupported syntax",
  "invalid-react-selector": "React selector is invalid",
  "unknown-react-scope": "Requested React scope is unknown to the catalog",
  "react-source-not-matched": "No React source element matched the evidence",
  "react-source-ambiguous": "Multiple React source elements matched the evidence",
  "react-sensitive-value-redacted": "Sensitive React value was redacted",
  "react-text-truncated": "React text value was truncated",
};

const LEVEL_ORDER: Record<ReactSourceDiagnostic["level"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function createReactDiagnostic(
  code: ReactSourceDiagnosticCode,
  level: ReactSourceDiagnostic["level"],
  message?: string,
  uri?: string,
): ReactSourceDiagnostic {
  const diagnostic: ReactSourceDiagnostic = {
    code,
    level,
    message: message ?? MESSAGES[code],
  };
  if (uri !== undefined) {
    diagnostic.uri = uri;
  }
  return diagnostic;
}

export function sortReactDiagnostics(diagnostics: ReactSourceDiagnostic[]): ReactSourceDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
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
