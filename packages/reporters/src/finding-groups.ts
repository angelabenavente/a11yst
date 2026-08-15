import type { Finding, Severity } from "@a11yst/types";
import {
  resolveFindingRecommendationSummary,
  type FindingRecommendationSummary,
} from "./finding-source-report.js";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "minor"];

export type FindingGroup = {
  key: string;
  severity: Severity;
  ruleId: string;
  title: string;
  findings: Finding[];
  recommendation?: FindingRecommendationSummary;
};

function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

function compareFindingsStable(left: Finding, right: Finding): number {
  const routeOrder = (left.route ?? "").localeCompare(right.route ?? "");
  if (routeOrder !== 0) {
    return routeOrder;
  }
  const targetLeft = left.target.join(" ");
  const targetRight = right.target.join(" ");
  const targetOrder = targetLeft.localeCompare(targetRight);
  if (targetOrder !== 0) {
    return targetOrder;
  }
  return left.fingerprint.localeCompare(right.fingerprint);
}

function recommendationKey(finding: Finding): string {
  const summary = resolveFindingRecommendationSummary(finding);
  if (!summary) {
    return "";
  }
  return [summary.title ?? "", summary.summary ?? "", summary.applicability ?? ""].join("\0");
}

export function buildFindingGroupKey(finding: Finding): string {
  return [
    finding.severity,
    finding.ruleId,
    recommendationKey(finding),
    finding.route ?? "",
    finding.profile ?? "",
    finding.flowId ?? "",
    finding.title,
  ].join("\0");
}

export function groupFindings(findings: Finding[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();

  for (const finding of findings) {
    const key = buildFindingGroupKey(finding);
    const existing = groups.get(key);
    if (existing) {
      existing.findings.push(finding);
      continue;
    }
    groups.set(key, {
      key,
      severity: finding.severity,
      ruleId: finding.ruleId,
      title: finding.title,
      findings: [finding],
      recommendation: resolveFindingRecommendationSummary(finding),
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      findings: [...group.findings].sort(compareFindingsStable),
    }))
    .sort((left, right) => {
      const severityOrder = severityRank(left.severity) - severityRank(right.severity);
      if (severityOrder !== 0) {
        return severityOrder;
      }
      const ruleOrder = left.ruleId.localeCompare(right.ruleId);
      if (ruleOrder !== 0) {
        return ruleOrder;
      }
      const routeLeft = left.findings[0]?.route ?? "";
      const routeRight = right.findings[0]?.route ?? "";
      return routeLeft.localeCompare(routeRight);
    });
}

export function countUniqueIssues(findings: Finding[]): number {
  return groupFindings(findings).length;
}
