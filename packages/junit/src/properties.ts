import type { BaselineSummary } from "@a11yst/types";
import type { JunitGenerationInput, JunitProperty } from "./types.js";

export function sortProperties(properties: JunitProperty[]): JunitProperty[] {
  return [...properties].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildDocumentProperties(input: JunitGenerationInput): JunitProperty[] {
  const properties: JunitProperty[] = [
    { name: "a11yst.version", value: input.product.version },
    { name: "a11yst.audit.successful", value: String(input.audit.successful) },
  ];
  appendBaselineProperties(properties, input.baselineSummary);
  appendFindingSummaryProperties(properties, input);
  if (input.baselineSummary && input.baselineSummary.notComparedFindings > 0) {
    properties.push({ name: "a11yst.comparison.complete", value: "false" });
  } else if (input.comparisonCoverage) {
    const incomplete =
      input.comparisonCoverage.excludedProjects.length > 0 ||
      input.comparisonCoverage.failedRuns.length > 0 ||
      input.comparisonCoverage.skippedRuns.length > 0;
    if (incomplete) {
      properties.push({ name: "a11yst.comparison.complete", value: "false" });
    }
  }
  return sortProperties(properties);
}

export function buildProjectProperties(projectName: string): JunitProperty[] {
  return sortProperties([{ name: "a11yst.project", value: projectName }]);
}

function appendBaselineProperties(
  properties: JunitProperty[],
  summary: BaselineSummary | undefined,
): void {
  if (!summary) {
    properties.push({ name: "a11yst.baseline.used", value: "false" });
    return;
  }
  properties.push({ name: "a11yst.baseline.used", value: String(summary.baselineUsed) });
  if (!summary.baselineUsed) {
    return;
  }
  properties.push(
    { name: "a11yst.baseline.known", value: String(summary.knownFindings) },
    { name: "a11yst.baseline.new", value: String(summary.newFindings) },
    { name: "a11yst.baseline.notCompared", value: String(summary.notComparedFindings) },
    { name: "a11yst.baseline.regressed", value: String(summary.regressedFindings) },
    { name: "a11yst.baseline.resolved", value: String(summary.resolvedFindings) },
    { name: "a11yst.findings.current", value: String(summary.currentFindings) },
    { name: "a11yst.findings.known", value: String(summary.knownFindings) },
    { name: "a11yst.findings.new", value: String(summary.newFindings) },
    { name: "a11yst.findings.notCompared", value: String(summary.notComparedFindings) },
    { name: "a11yst.findings.regressed", value: String(summary.regressedFindings) },
    { name: "a11yst.findings.resolved", value: String(summary.resolvedFindings) },
    { name: "a11yst.classifications.expired", value: String(summary.expiredClassifications) },
  );
}

function appendFindingSummaryProperties(
  properties: JunitProperty[],
  input: JunitGenerationInput,
): void {
  if (input.baselineSummary?.baselineUsed) {
    return;
  }
  properties.push({ name: "a11yst.findings.current", value: String(input.findings.length) });
}
