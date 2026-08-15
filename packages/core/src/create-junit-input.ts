import { buildComparisonCoverage } from "@a11yst/baseline";
import type { AuditExecutionResult, ResolvedCiPolicyConfig } from "@a11yst/types";
import { productMetadata } from "@a11yst/types";
import type { JunitGenerationInput } from "@a11yst/junit";

export function createJunitInputFromAuditResult(
  result: AuditExecutionResult,
  policy?: ResolvedCiPolicyConfig,
): JunitGenerationInput {
  const comparisonCoverage =
    result.baselineSummary?.baselineUsed === true
      ? buildComparisonCoverage(result)
      : undefined;

  return {
    product: {
      name: result.environment.product ?? productMetadata.name,
      version: result.environment.productVersion ?? productMetadata.version,
    },
    audit: {
      ...(result.auditId ? { id: result.auditId } : {}),
      successful: result.status !== "failed",
      durationMs: result.summary.durationMs,
    },
    findings: result.findings,
    ...(result.resolvedFindings ? { resolvedFindings: result.resolvedFindings } : {}),
    runs: result.runs,
    ...(result.policyEvaluation ? { policyEvaluation: result.policyEvaluation } : {}),
    ...(result.baselineSummary ? { baselineSummary: result.baselineSummary } : {}),
    ...(comparisonCoverage ? { comparisonCoverage } : {}),
    ...(policy?.minimumSeverity ? { policyMinimumSeverity: policy.minimumSeverity } : {}),
  };
}
