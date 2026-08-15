import type { Finding, PolicyEvaluationResult } from "@a11yst/types";
import type { SarifGenerationInput } from "./types.js";

export function isComparisonComplete(input: SarifGenerationInput): boolean {
  if (!input.baselineSummary?.baselineUsed) {
    return false;
  }

  if (input.baselineSummary.notComparedFindings > 0) {
    return false;
  }

  const coverage = input.comparisonCoverage;
  if (coverage) {
    if (
      coverage.excludedProjects.length > 0 ||
      coverage.failedRuns.length > 0 ||
      coverage.skippedRuns.length > 0
    ) {
      return false;
    }
  }

  for (const finding of input.findings) {
    const status = finding.baseline?.status;
    if (!status || !isComparableLifecycle(status)) {
      return false;
    }
  }

  return true;
}

export function isComparableLifecycle(
  status: string,
): status is "new" | "known" | "regressed" {
  return status === "new" || status === "known" || status === "regressed";
}

export function mapLifecycleToBaselineState(
  status: "new" | "known" | "regressed",
): "new" | "unchanged" | "updated" {
  switch (status) {
    case "new":
      return "new";
    case "known":
      return "unchanged";
    case "regressed":
      return "updated";
  }
}

export function buildPolicyBreachMap(
  evaluation: PolicyEvaluationResult | undefined,
): Map<string, PolicyEvaluationResult["breaches"][number]["kind"]> {
  const map = new Map<string, PolicyEvaluationResult["breaches"][number]["kind"]>();
  if (!evaluation) {
    return map;
  }
  for (const breach of evaluation.breaches) {
    map.set(breach.fingerprint, breach.kind);
  }
  return map;
}

export function fingerprintKey(finding: Finding): string {
  const version = finding.fingerprintVersion ?? "1";
  return `${version}:${finding.fingerprint}`;
}
