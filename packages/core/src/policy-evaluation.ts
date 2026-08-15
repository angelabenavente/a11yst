import { evaluateCiPolicy } from "@a11yst/policy";
import type {
  AuditExecutionResult,
  ComparisonCoverage,
  PolicyEvaluationResult,
  ResolvedCiPolicyConfig,
} from "@a11yst/types";
import type { ApplyBaselineComparisonOutput } from "./baseline-comparison.js";

export function applyPolicyEvaluation(
  result: AuditExecutionResult,
  policy: ResolvedCiPolicyConfig,
  baselineApplied: ApplyBaselineComparisonOutput,
): PolicyEvaluationResult {
  const comparisonCoverage: ComparisonCoverage | undefined =
    baselineApplied.comparison?.artifact?.coverage;

  return evaluateCiPolicy({
    policy,
    baselineUsed: result.baselineSummary?.baselineUsed ?? false,
    findings: result.findings,
    baselineSummary: result.baselineSummary,
    comparisonCoverage,
    diagnostics: result.diagnostics,
  });
}
