import { buildComparisonCoverage } from "@a11yst/baseline";
import { countUniqueIssues, type MarkdownReportInput } from "@a11yst/reporters";
import type { AuditExecutionResult, ResolvedCiPolicyConfig, Severity } from "@a11yst/types";
import { productMetadata } from "@a11yst/types";

function emptySeverityCounts(): Record<Severity, number> {
  return { critical: 0, high: 0, medium: 0, minor: 0 };
}

export function createMarkdownInputFromAuditResult(
  result: AuditExecutionResult,
  policy?: ResolvedCiPolicyConfig,
  reportPaths?: MarkdownReportInput["reports"],
): MarkdownReportInput {
  const comparisonCoverage =
    result.baselineSummary?.baselineUsed === true
      ? buildComparisonCoverage(result)
      : undefined;

  const webProject = result.plan.projects.find((project) => project.platform === "web");
  const routes = [
    ...new Set(
      result.runs.map((run) => run.route).filter((route): route is string => Boolean(route)),
    ),
  ].sort();
  const profiles = [...new Set(result.runs.map((run) => run.profile))].sort();
  const viewports = [
    ...new Set(
      result.runs
        .map((run) => run.viewport?.name)
        .filter((viewport): viewport is string => Boolean(viewport)),
    ),
  ].sort();

  const findingsBySeverity = { ...emptySeverityCounts(), ...result.summary.findingsBySeverity };

  return {
    product: {
      name: result.environment.product ?? productMetadata.name,
      version: result.environment.productVersion ?? productMetadata.version,
    },
    audit: {
      successful: result.status !== "failed",
    },
    metadata: {
      auditId: result.auditId,
      project: webProject?.name,
      framework: webProject && webProject.platform === "web" ? webProject.framework : undefined,
      target: webProject && webProject.platform === "web" ? webProject.baseUrl : undefined,
      startedAt: result.summary.startedAt,
      routes,
      profiles,
      viewports,
      uniqueIssueGroups: countUniqueIssues(result.findings),
      totalAffectedElements: result.summary.findingCount,
      findingsBySeverity,
      profileSummary: result.profileSummary,
      executionFailed: result.status === "failed",
      failureMessages: result.diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => diagnostic.message),
    },
    findings: result.findings,
    ...(result.resolvedFindings ? { resolvedFindings: result.resolvedFindings } : {}),
    ...(result.policyEvaluation ? { policyEvaluation: result.policyEvaluation } : {}),
    ...(result.baselineSummary ? { baselineSummary: result.baselineSummary } : {}),
    ...(comparisonCoverage ? { comparisonCoverage } : {}),
    ...(policy?.minimumSeverity ? { policyMinimumSeverity: policy.minimumSeverity } : {}),
    ...(reportPaths ? { reports: reportPaths } : {}),
  };
}
