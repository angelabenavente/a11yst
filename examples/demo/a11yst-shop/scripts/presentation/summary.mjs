/**
 * Demo-only summary model. Not part of the a11yst public API.
 */

function countLifecycle(findings, status) {
  return findings.filter((finding) => finding.baseline?.status === status).length;
}

function countMappingStatus(findings, status) {
  return findings.filter((finding) => finding.sourceMapping?.status === status).length;
}

function hasRecommendation(finding) {
  const status = finding.recommendations?.status;
  return status === "recommended" || status === "manual-review";
}

/**
 * @param {import('@a11yst/types').AuditExecutionResult} results
 * @param {number} policyExitCode
 */
export function createDemoSummary(results, policyExitCode = 0) {
  const findings = results.findings ?? [];
  const baselineSummary = results.baselineSummary;
  const sourceAnalysisResult = results.sourceAnalysis;

  const lifecycle = {
    total: findings.length,
    new: baselineSummary?.newFindings ?? countLifecycle(findings, "new"),
    known: baselineSummary?.knownFindings ?? countLifecycle(findings, "known"),
    regressed: baselineSummary?.regressedFindings ?? countLifecycle(findings, "regressed"),
    resolved:
      baselineSummary?.resolvedFindings ?? (results.resolvedFindings?.length ?? 0),
    notCompared:
      baselineSummary?.notComparedFindings ?? (results.notComparedFindings?.length ?? 0),
    interactive: findings.filter(
      (finding) => Boolean(finding.flowId && finding.checkpointId),
    ).length,
  };

  const sourceAnalysis = {
    mapped:
      sourceAnalysisResult?.mappedFindings ?? countMappingStatus(findings, "mapped"),
    ambiguous:
      sourceAnalysisResult?.ambiguousFindings ?? countMappingStatus(findings, "ambiguous"),
    unmapped:
      sourceAnalysisResult?.unmappedFindings ?? countMappingStatus(findings, "unmapped"),
    invalid:
      sourceAnalysisResult?.invalidFindings ?? countMappingStatus(findings, "invalid"),
  };

  const recommendations = {
    findingsWithRecommendations: findings.filter(hasRecommendation).length,
  };

  const policyEvaluation = results.policyEvaluation;
  const breached =
    policyEvaluation?.status === "failed" ||
    (policyExitCode === 2 && policyEvaluation?.policyEnabled !== false);

  return {
    findings: lifecycle,
    sourceAnalysis,
    recommendations,
    policy: {
      exitCode: policyExitCode,
      breached,
      enabled: policyEvaluation?.policyEnabled ?? false,
    },
  };
}
