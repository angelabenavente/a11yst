import type { SourceMappingDiagnostic, SourceMappingDiagnosticCode } from "@a11yst/types";

const MESSAGES: Record<SourceMappingDiagnosticCode, string> = {
  "missing-source-location": "No existing source location was provided",
  "invalid-source-uri": "Source URI is invalid or not repository-relative",
  "invalid-source-region": "Source region contains invalid line or column values",
  "unsafe-source-path": "Source path is unsafe or escapes the repository root",
  "duplicate-candidate": "Duplicate source mapping candidates were merged",
  "conflicting-exact-candidates": "Multiple exact candidates point to different locations",
  "ambiguous-candidates": "No unambiguous source mapping candidate could be selected",
  "unsupported-provenance": "Confidence and provenance combination is not supported",
  "truncated-signal": "Signal value was truncated to the allowed length",
  "sensitive-value-redacted": "Sensitive signal value was redacted",
};

export function createDiagnostic(
  code: SourceMappingDiagnosticCode,
  level: SourceMappingDiagnostic["level"],
  message?: string,
  uri?: string,
): SourceMappingDiagnostic {
  const diagnostic: SourceMappingDiagnostic = {
    code,
    level,
    message: message ?? MESSAGES[code],
  };

  if (uri !== undefined) {
    diagnostic.uri = uri;
  }

  return diagnostic;
}
