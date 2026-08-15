import { buildComparisonCoverage } from "@a11yst/baseline";
import type { AuditExecutionResult } from "@a11yst/types";
import { productMetadata } from "@a11yst/types";
import type { SarifGenerationInput } from "@a11yst/sarif";

export function createSarifInputFromAuditResult(
  result: AuditExecutionResult,
): SarifGenerationInput {
  const comparisonCoverage =
    result.baselineSummary?.baselineUsed === true
      ? buildComparisonCoverage(result)
      : undefined;

  return {
    product: {
      name: result.environment.product ?? productMetadata.name,
      version: result.environment.productVersion ?? productMetadata.version,
    },
    findings: result.findings,
    ...(result.resolvedFindings ? { resolvedFindings: result.resolvedFindings } : {}),
    ...(result.policyEvaluation ? { policyEvaluation: result.policyEvaluation } : {}),
    ...(result.baselineSummary ? { baselineSummary: result.baselineSummary } : {}),
    ...(comparisonCoverage ? { comparisonCoverage } : {}),
    execution: {
      successful: result.status !== "failed",
      projectNames: result.plan.projects.map((project) => project.name),
    },
  };
}
