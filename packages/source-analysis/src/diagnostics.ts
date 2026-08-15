import type { SourceAnalysisDiagnostic, SourceAnalysisDiagnosticCode } from "@a11yst/types";

export function createSourceAnalysisDiagnostic(
  code: SourceAnalysisDiagnosticCode,
  level: SourceAnalysisDiagnostic["level"],
  message: string,
  details?: Partial<Pick<SourceAnalysisDiagnostic, "projectId" | "findingFingerprint" | "framework">>,
): SourceAnalysisDiagnostic {
  return {
    code,
    level,
    message,
    ...(details?.projectId ? { projectId: details.projectId } : {}),
    ...(details?.findingFingerprint ? { findingFingerprint: details.findingFingerprint } : {}),
    ...(details?.framework ? { framework: details.framework } : {}),
  };
}

const LEVEL_ORDER: Record<SourceAnalysisDiagnostic["level"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function sortSourceAnalysisDiagnostics(
  diagnostics: SourceAnalysisDiagnostic[],
): SourceAnalysisDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const levelOrder = LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level];
    if (levelOrder !== 0) {
      return levelOrder;
    }
    const codeOrder = left.code.localeCompare(right.code);
    if (codeOrder !== 0) {
      return codeOrder;
    }
    const projectOrder = (left.projectId ?? "").localeCompare(right.projectId ?? "");
    if (projectOrder !== 0) {
      return projectOrder;
    }
    const fingerprintOrder = (left.findingFingerprint ?? "").localeCompare(right.findingFingerprint ?? "");
    if (fingerprintOrder !== 0) {
      return fingerprintOrder;
    }
    return left.message.localeCompare(right.message);
  });
}
