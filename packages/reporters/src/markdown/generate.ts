import type {
  Finding,
  FindingLocation,
  PolicyBreach,
  PolicyEvaluationResult,
  ResolvedFinding,
  Severity,
} from "@a11yst/types";
import { formatSeverityLabel } from "@a11yst/types";
import type {
  MarkdownReportDiagnostic,
  MarkdownReportInput,
  MarkdownReportOptions,
  MarkdownReportResult,
} from "./types.js";
import { escapeMarkdownTableCell, escapeMarkdownText } from "./escape.js";
import { buildSafeMarkdownLink } from "./links.js";
import { groupFindings } from "../finding-groups.js";
import {
  formatSafeReportSourceLocation,
  resolveFindingReportSource,
} from "../finding-source-report.js";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "minor"];
const DEFAULT_MAX_DETAILED = 100;

function fingerprintPrefix(fingerprint: string): string {
  return fingerprint.slice(0, 8);
}

function formatLocation(location: FindingLocation): string {
  if (location.kind === "route") {
    return `route ${location.route}`;
  }
  return `flow ${location.flowId} / ${location.checkpointId}`;
}

function breachKindLabel(kind: PolicyBreach["kind"]): string {
  switch (kind) {
    case "new-finding":
      return "New";
    case "regressed-finding":
      return "Regression";
    case "expired-classification":
      return "Expired classification";
  }
}

function auditStatusLabel(successful: boolean): string {
  return successful ? "Completed" : "Failed";
}

function policyStatusLabel(evaluation: PolicyEvaluationResult | undefined): string {
  if (!evaluation) {
    return "Not available";
  }
  if (!evaluation.policyEnabled) {
    return "Disabled";
  }
  switch (evaluation.status) {
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "not-evaluated":
      return "Not evaluated";
  }
}

function countLifecycle(input: MarkdownReportInput): MarkdownReportResult["summary"] {
  const baseline = input.baselineSummary;
  const findings = input.findings.length;
  return {
    findings,
    newFindings: baseline?.newFindings ?? input.findings.filter((f) => f.baseline?.status === "new").length,
    knownFindings: baseline?.knownFindings ?? input.findings.filter((f) => f.baseline?.status === "known").length,
    regressedFindings:
      baseline?.regressedFindings ?? input.findings.filter((f) => f.baseline?.status === "regressed").length,
    resolvedFindings: baseline?.resolvedFindings ?? input.resolvedFindings?.length ?? 0,
    notComparedFindings: baseline?.notComparedFindings ?? 0,
    policyBreaches: input.policyEvaluation?.summary.totalBreaches ?? 0,
    detailedFindings: 0,
    truncatedFindings: 0,
  };
}

function formatFindingLocationMarkdown(finding: Finding): { label: string; kind: "source" | "target" } {
  const ranked = finding.sourceRanking?.selected;
  if (ranked?.location) {
    return {
      label: formatSafeReportSourceLocation(ranked.location),
      kind: "source",
    };
  }
  const source = resolveFindingReportSource(finding);
  if (source.status === "mapped" && source.location) {
    return {
      label: formatSafeReportSourceLocation(source.location),
      kind: "source",
    };
  }
  if (source.status === "ambiguous" && source.alternatives?.[0]) {
    return {
      label: formatSafeReportSourceLocation(source.alternatives[0]),
      kind: "source",
    };
  }
  return {
    label: finding.target.join(" > ") || "(no target)",
    kind: "target",
  };
}

function buildMetadataSection(input: MarkdownReportInput): string[] {
  const metadata = input.metadata;
  if (!metadata) {
    return [];
  }
  const rows: Array<[string, string]> = [];
  if (metadata.project) rows.push(["Project", metadata.project]);
  if (metadata.auditId) rows.push(["Audit ID", metadata.auditId]);
  if (metadata.target) rows.push(["Target", metadata.target]);
  if (metadata.framework) rows.push(["Framework", metadata.framework]);
  if (metadata.startedAt) rows.push(["Date", metadata.startedAt]);
  if (metadata.routes?.length) rows.push(["Routes", String(metadata.routes.length)]);
  if (metadata.profiles?.length) rows.push(["Profiles", metadata.profiles.join(", ")]);
  if (metadata.viewports?.length) rows.push(["Viewports", metadata.viewports.join(", ")]);
  if (rows.length === 0) {
    return [];
  }
  const lines = ["## Audit metadata", "", "| Item | Value |", "| --- | --- |"];
  for (const [item, value] of rows) {
    lines.push(`| ${escapeMarkdownTableCell(item)} | ${escapeMarkdownTableCell(value)} |`);
  }
  return lines;
}

function buildSeveritySummarySection(input: MarkdownReportInput): string[] {
  const metadata = input.metadata;
  const counts = metadata?.findingsBySeverity ?? {};
  const lines = [
    "## Summary",
    "",
    "| Severity | Affected elements |",
    "| --- | ---: |",
  ];
  for (const severity of SEVERITY_ORDER) {
    lines.push(`| ${escapeMarkdownTableCell(formatSeverityLabel(severity))} | ${counts[severity] ?? 0} |`);
  }
  lines.push("");
  if (metadata?.uniqueIssueGroups !== undefined) {
    lines.push(`Unique issue groups: ${metadata.uniqueIssueGroups}`);
  }
  if (metadata?.totalAffectedElements !== undefined) {
    lines.push(`Total affected elements: ${metadata.totalAffectedElements}`);
  }
  return lines;
}

function buildExecutionFailureSection(input: MarkdownReportInput): string[] {
  if (!input.metadata?.executionFailed) {
    return [];
  }
  const lines = ["## Execution", "", "Audit execution failed.", ""];
  for (const message of input.metadata.failureMessages ?? []) {
    lines.push(`- ${escapeMarkdownText(message)}`);
  }
  return lines;
}

function buildGroupedFindingsSection(
  input: MarkdownReportInput,
  options: MarkdownReportOptions,
  diagnostics: MarkdownReportDiagnostic[],
): { lines: string[]; detailed: number; truncated: number } {
  if (input.metadata?.executionFailed && input.findings.length === 0) {
    return { lines: [], detailed: 0, truncated: 0 };
  }
  const groups = groupFindings(input.findings);
  if (groups.length === 0) {
    return { lines: [], detailed: 0, truncated: 0 };
  }

  const maxDetailed = options.maxDetailedFindings ?? DEFAULT_MAX_DETAILED;
  let shownInstances = 0;
  let truncated = 0;
  const lines = ["## Findings", ""];

  for (const group of groups) {
    const count = group.findings.length;
    const countLabel = count === 1 ? "1 affected element" : `${count} affected elements`;
    lines.push(
      `### ${formatSeverityLabel(group.severity)} · ${escapeMarkdownText(group.ruleId)} · ${countLabel}`,
    );
    lines.push("");
    lines.push(escapeMarkdownText(group.title));
    lines.push("");
    lines.push("**Affected elements:**");
    lines.push("");

    for (const finding of group.findings) {
      if (shownInstances >= maxDetailed) {
        truncated += 1;
        continue;
      }
      shownInstances += 1;
      const location = formatFindingLocationMarkdown(finding);
      const prefix = location.kind === "source" ? "Likely source" : "Target";
      lines.push(
        `${shownInstances}. ${prefix}: \`${escapeMarkdownText(location.label)}\``,
      );
      if (finding.route) {
        lines.push(`   - Route: ${escapeMarkdownText(finding.route)}`);
      }
      const baselineStatus = finding.baseline?.status;
      if (baselineStatus) {
        lines.push(`   - Baseline: ${escapeMarkdownText(baselineStatus)}`);
      }
      lines.push("");
    }

    const recommendation = group.recommendation;
    if (recommendation?.title || recommendation?.summary) {
      lines.push("**Recommendation:**");
      lines.push("");
      if (recommendation.title) {
        lines.push(`- ${escapeMarkdownText(recommendation.title)}`);
      }
      if (recommendation.summary) {
        lines.push(`- ${escapeMarkdownText(recommendation.summary)}`);
      }
      lines.push("");
    }
  }

  if (truncated > 0) {
    diagnostics.push({
      code: "truncated-findings",
      level: "info",
      message: `Detailed findings truncated to ${maxDetailed}.`,
    });
    lines.push(`${truncated} additional affected elements are not shown.`);
    lines.push("");
  }

  return { lines, detailed: shownInstances, truncated };
}

function buildProfileCoverageSection(input: MarkdownReportInput): string[] {
  const profileSummary = input.metadata?.profileSummary;
  if (!profileSummary) {
    return [];
  }
  const lines = ["## Coverage", ""];
  lines.push(`Automated barriers: ${profileSummary.findingsByAutomation.automated}`);
  lines.push(`Heuristic findings: ${profileSummary.findingsByAutomation.heuristic}`);
  lines.push(`Generated manual checks: ${profileSummary.manualReviewPending}`);
  lines.push("");
  for (const coverage of profileSummary.coverage) {
    lines.push(`### ${escapeMarkdownText(coverage.profile)}`);
    lines.push("");
    lines.push("Automated checks completed");
    for (const check of coverage.automatedChecks) {
      lines.push(`- ${escapeMarkdownText(check)}`);
    }
    if (coverage.heuristicChecks.length > 0) {
      lines.push("");
      lines.push("Heuristic profile coverage");
      for (const check of coverage.heuristicChecks) {
        lines.push(`- ${escapeMarkdownText(check)}`);
      }
    }
    if (coverage.manualChecks.length > 0) {
      lines.push("");
      lines.push("Manual accessibility review still required");
      for (const check of coverage.manualChecks) {
        lines.push(`- ${escapeMarkdownText(check)}`);
      }
    }
    if (coverage.limitations.length > 0) {
      lines.push("");
      lines.push("Not covered");
      for (const limitation of coverage.limitations) {
        lines.push(`- ${escapeMarkdownText(limitation)}`);
      }
    }
    lines.push("");
  }
  return lines;
}

function sortBreaches(breaches: PolicyBreach[]): PolicyBreach[] {
  return [...breaches].sort((a, b) => {
    const severityDiff =
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severityDiff !== 0) return severityDiff;
    const kindDiff = a.kind.localeCompare(b.kind);
    if (kindDiff !== 0) return kindDiff;
    const projectDiff = a.projectName.localeCompare(b.projectName);
    if (projectDiff !== 0) return projectDiff;
    const ruleDiff = a.ruleId.localeCompare(b.ruleId);
    if (ruleDiff !== 0) return ruleDiff;
    return a.fingerprint.localeCompare(b.fingerprint);
  });
}

function buildStatusTable(
  input: MarkdownReportInput,
  diagnostics: MarkdownReportDiagnostic[],
): string[] {
  const evaluation = input.policyEvaluation;
  const rows: Array<[string, string]> = [
    ["Audit", auditStatusLabel(input.audit.successful)],
  ];
  if (evaluation) {
    rows.push(["CI policy", policyStatusLabel(evaluation)]);
    if (evaluation.policyEnabled && input.policyMinimumSeverity) {
      rows.push(["Minimum severity", formatSeverityLabel(input.policyMinimumSeverity)]);
    }
    if (evaluation.policyEnabled) {
      rows.push(["Policy breaches", String(evaluation.summary.totalBreaches)]);
    }
  } else {
    rows.push(["CI policy", "Not available"]);
    diagnostics.push({
      code: "missing-policy-data",
      level: "info",
      message: "Policy evaluation metadata was not available.",
    });
  }
  const lines = ["## Status", "", "| Item | Result |", "| --- | --- |"];
  for (const [item, result] of rows) {
    lines.push(`| ${escapeMarkdownTableCell(item)} | ${escapeMarkdownTableCell(result)} |`);
  }
  if (evaluation?.status === "passed") {
    lines.push("");
    lines.push(
      "The configured automated CI policy did not report any blocking breaches in this audit.",
    );
  }
  if (evaluation?.status === "failed") {
    lines.push("");
    lines.push("The configured CI policy reported blocking breaches. Expected exit code: 2.");
  }
  if (evaluation?.status === "not-evaluated") {
    lines.push("");
    const message =
      evaluation.diagnostics.find((entry) => entry.level === "error")?.message ??
      evaluation.diagnostics[0]?.message ??
      "The enabled CI policy could not be evaluated.";
    lines.push(escapeMarkdownText(message));
  }
  return lines;
}

function buildLifecycleTable(summary: MarkdownReportResult["summary"]): string[] {
  return [
    "## Accessibility lifecycle",
    "",
    "| Status | Count |",
    "| --- | ---: |",
    `| New | ${summary.newFindings} |`,
    `| Known | ${summary.knownFindings} |`,
    `| Regressed | ${summary.regressedFindings} |`,
    `| Resolved | ${summary.resolvedFindings} |`,
    `| Not compared | ${summary.notComparedFindings} |`,
  ];
}

function buildBreachesSection(
  evaluation: PolicyEvaluationResult,
): string[] {
  if (!evaluation.policyEnabled || evaluation.breaches.length === 0) {
    return [];
  }
  const lines = [
    "## CI policy breaches",
    "",
    "| Severity | Kind | Rule | Project | Location | Profile | Disposition | Owner | Ticket | Fingerprint |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const breach of sortBreaches(evaluation.breaches)) {
    const profile = breach.location.kind === "route" ? breach.location.profile : breach.location.profile;
    lines.push(
      `| ${escapeMarkdownTableCell(formatSeverityLabel(breach.severity))} | ${escapeMarkdownTableCell(breachKindLabel(breach.kind))} | ${escapeMarkdownTableCell(breach.ruleId)} | ${escapeMarkdownTableCell(breach.projectName)} | ${escapeMarkdownTableCell(formatLocation(breach.location))} | ${escapeMarkdownTableCell(profile)} | ${escapeMarkdownTableCell(breach.disposition ?? "")} | | | ${escapeMarkdownTableCell(fingerprintPrefix(breach.fingerprint))} |`,
    );
  }
  return lines;
}

function buildCoverageSection(
  input: MarkdownReportInput,
  summary: MarkdownReportResult["summary"],
): string[] {
  const coverage = input.comparisonCoverage;
  if (!coverage && summary.notComparedFindings === 0) {
    return [];
  }
  const lines = ["## Comparison coverage", ""];
  if (summary.notComparedFindings > 0) {
    lines.push("Comparison coverage is incomplete.");
    lines.push("Findings outside the executed scope were not compared.");
    lines.push("");
  }
  if (coverage) {
    if (coverage.excludedProjects.length > 0) {
      lines.push(`Excluded projects: ${coverage.excludedProjects.join(", ")}.`);
    }
    if (coverage.failedRuns.length > 0) {
      lines.push(`Failed runs: ${coverage.failedRuns.length}.`);
    }
    if (coverage.skippedRuns.length > 0) {
      lines.push(`Skipped runs: ${coverage.skippedRuns.length}.`);
    }
  }
  return lines;
}

function buildClassificationsSection(
  input: MarkdownReportInput,
  includeClassifications: boolean,
): string[] {
  if (!includeClassifications || !input.baselineSummary) {
    return [];
  }
  const dispositions = input.baselineSummary.dispositions;
  const lines = [
    "## Classified findings",
    "",
    "| Disposition | Count |",
    "| --- | ---: |",
    `| false-positive | ${dispositions.falsePositive} |`,
    `| not-applicable | ${dispositions.notApplicable} |`,
    `| accepted-risk | ${dispositions.acceptedRisk} |`,
    `| third-party | ${dispositions.thirdParty} |`,
    `| manual-review | ${dispositions.manualReview} |`,
    `| expired classifications | ${input.baselineSummary.expiredClassifications} |`,
  ];
  return lines;
}

function buildResolvedSection(resolved: ResolvedFinding[] | undefined): string[] {
  if (!resolved || resolved.length === 0) {
    return [];
  }
  const lines = [
    "## Resolved findings",
    "",
    "| Rule | Project | Location | Profile | Previous severity |",
    "| --- | --- | --- | --- | --- |",
  ];
  const sorted = [...resolved].sort((a, b) => {
    const rule = a.ruleId.localeCompare(b.ruleId);
    if (rule !== 0) return rule;
    return a.fingerprint.localeCompare(b.fingerprint);
  });
  for (const item of sorted) {
    const profile = item.location.kind === "route" ? item.location.profile : item.location.profile;
    lines.push(
      `| ${escapeMarkdownTableCell(item.ruleId)} | ${escapeMarkdownTableCell(item.projectName)} | ${escapeMarkdownTableCell(formatLocation(item.location))} | ${escapeMarkdownTableCell(profile)} | ${escapeMarkdownTableCell(item.previousSeverity)} |`,
    );
  }
  return lines;
}

function buildArtifactsSection(
  input: MarkdownReportInput,
  diagnostics: MarkdownReportDiagnostic[],
): string[] {
  const reports = input.reports;
  if (!reports) {
    return [];
  }
  const lines = ["## Reports", ""];
  if (reports.html) {
    lines.push(`HTML report: ${buildSafeMarkdownLink("report/index.html", reports.html.path, diagnostics)}`);
  }
  if (reports.markdown) {
    lines.push(`Markdown report: ${buildSafeMarkdownLink("reports/a11yst.md", reports.markdown.path, diagnostics)}`);
  }
  lines.push("JSON results: `results.json`");
  if (reports.sarif) {
    lines.push(`SARIF report: ${buildSafeMarkdownLink("SARIF report", reports.sarif.path, diagnostics)}`);
  }
  if (reports.junit) {
    lines.push(`JUnit report: ${buildSafeMarkdownLink("JUnit report", reports.junit.path, diagnostics)}`);
  }
  return lines.length > 2 ? lines : [];
}

export function generateMarkdownReport(
  input: MarkdownReportInput,
  options: MarkdownReportOptions = {},
): MarkdownReportResult {
  const diagnostics: MarkdownReportDiagnostic[] = [];
  const summary = countLifecycle(input);
  const title = options.title ?? "a11yst Accessibility Report";
  const grouped = buildGroupedFindingsSection(input, options, diagnostics);
  summary.detailedFindings = grouped.detailed;
  summary.truncatedFindings = grouped.truncated;

  const sections: string[][] = [
    [`# ${escapeMarkdownText(title)}`, ""],
    buildMetadataSection(input),
    [""],
    buildExecutionFailureSection(input),
    [""],
    buildSeveritySummarySection(input),
    [""],
    buildStatusTable(input, diagnostics),
    [""],
    buildLifecycleTable(summary),
    [""],
  ];
  if (grouped.lines.length > 0) {
    sections.push(grouped.lines, [""]);
  }
  if (input.policyEvaluation && input.policyEvaluation.policyEnabled && input.policyEvaluation.breaches.length > 0) {
    sections.push(buildBreachesSection(input.policyEvaluation), [""]);
  }
  const comparisonCoverage = buildCoverageSection(input, summary);
  if (comparisonCoverage.length > 0) {
    sections.push(comparisonCoverage, [""]);
  }
  const profileCoverage = buildProfileCoverageSection(input);
  if (profileCoverage.length > 0) {
    sections.push(profileCoverage, [""]);
  }
  const classifications = buildClassificationsSection(input, options.includeClassifications ?? true);
  if (classifications.length > 0) {
    sections.push(classifications, [""]);
  }
  if (options.includeResolvedSummary !== false) {
    const resolved = buildResolvedSection(input.resolvedFindings);
    if (resolved.length > 0) {
      sections.push(resolved, [""]);
    }
  }
  const artifacts = buildArtifactsSection(input, diagnostics);
  if (artifacts.length > 0) {
    sections.push(artifacts, [""]);
  }
  sections.push([
    "> Automated testing does not establish WCAG conformance.",
    "> Manual accessibility review remains necessary.",
  ]);
  if (input.baselineSummary?.baselineUsed) {
    sections.push([
      "",
      "> A baseline records known accessibility debt.",
      "> It does not make that debt accessible or compliant.",
    ]);
  }

  const markdown = `${sections.flat().filter((block) => block.length > 0).join("\n").replace(/\n{3,}/g, "\n\n")}\n`;

  return {
    markdown,
    summary,
    diagnostics: [...diagnostics].sort((a, b) => {
      const byCode = a.code.localeCompare(b.code);
      return byCode !== 0 ? byCode : a.message.localeCompare(b.message);
    }),
  };
}
