import type { RecommendationDiagnostic } from "@a11yst/types";
import { DIAGNOSTIC_CODE_ORDER, DIAGNOSTIC_LEVEL_ORDER } from "./constants.js";

export function createRecommendationDiagnostic(
  code: RecommendationDiagnostic["code"],
  level: RecommendationDiagnostic["level"],
  message: string,
  ruleId?: string,
  uri?: string,
): RecommendationDiagnostic {
  const diagnostic: RecommendationDiagnostic = { code, level, message };
  if (ruleId !== undefined) {
    diagnostic.ruleId = ruleId;
  }
  if (uri !== undefined) {
    diagnostic.uri = uri;
  }
  return diagnostic;
}

export function compareRecommendationDiagnostics(
  left: RecommendationDiagnostic,
  right: RecommendationDiagnostic,
): number {
  const levelOrder = DIAGNOSTIC_LEVEL_ORDER[left.level] - DIAGNOSTIC_LEVEL_ORDER[right.level];
  if (levelOrder !== 0) {
    return levelOrder;
  }
  const codeOrder = DIAGNOSTIC_CODE_ORDER.indexOf(left.code) - DIAGNOSTIC_CODE_ORDER.indexOf(right.code);
  if (codeOrder !== 0) {
    return codeOrder;
  }
  const ruleOrder = (left.ruleId ?? "").localeCompare(right.ruleId ?? "");
  if (ruleOrder !== 0) {
    return ruleOrder;
  }
  const uriOrder = (left.uri ?? "").localeCompare(right.uri ?? "");
  if (uriOrder !== 0) {
    return uriOrder;
  }
  return left.message.localeCompare(right.message);
}

export function sortRecommendationDiagnostics(diagnostics: RecommendationDiagnostic[]): RecommendationDiagnostic[] {
  return [...diagnostics].sort(compareRecommendationDiagnostics);
}
