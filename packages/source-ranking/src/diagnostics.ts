import type { SourceRankingDiagnostic } from "@a11yst/types";
import { RANKING_DIAGNOSTIC_CODE_ORDER, RANKING_DIAGNOSTIC_LEVEL_ORDER } from "./constants.js";

export function compareRankingDiagnostics(
  left: SourceRankingDiagnostic,
  right: SourceRankingDiagnostic,
): number {
  const levelOrder = RANKING_DIAGNOSTIC_LEVEL_ORDER[left.level] - RANKING_DIAGNOSTIC_LEVEL_ORDER[right.level];
  if (levelOrder !== 0) {
    return levelOrder;
  }

  const leftCodeIndex = RANKING_DIAGNOSTIC_CODE_ORDER.indexOf(left.code);
  const rightCodeIndex = RANKING_DIAGNOSTIC_CODE_ORDER.indexOf(right.code);
  if (leftCodeIndex !== rightCodeIndex) {
    return leftCodeIndex - rightCodeIndex;
  }

  const uriOrder = (left.uri ?? "").localeCompare(right.uri ?? "");
  if (uriOrder !== 0) {
    return uriOrder;
  }

  return left.message.localeCompare(right.message);
}

export function sortRankingDiagnostics(diagnostics: SourceRankingDiagnostic[]): SourceRankingDiagnostic[] {
  return [...diagnostics].sort(compareRankingDiagnostics);
}

export function createRankingDiagnostic(
  code: SourceRankingDiagnostic["code"],
  level: SourceRankingDiagnostic["level"],
  message: string,
  uri?: string,
): SourceRankingDiagnostic {
  const diagnostic: SourceRankingDiagnostic = { code, level, message };
  if (uri !== undefined) {
    diagnostic.uri = uri;
  }
  return diagnostic;
}
