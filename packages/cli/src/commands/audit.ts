import type {
  AuditExecutionResult,
  BaselineSummary,
  Finding,
  ResolvedFinding,
  Severity,
} from "@a11yst/types";
import { checkingMessage, formatLabelValue } from "../output.js";
import {
  formatAuditExecutionHeader,
  formatAuditFindingsPresentation,
  formatAuditFooterSummary,
  formatAuditRunSummaries,
  formatProfileReviewSections,
  type AuditPresentationOptions,
} from "../presentation/audit-presentation.js";
import { formatFlowExecutionsHuman, hasFlowExecutions } from "./audit-flow-output.js";
import { formatBaselineComparisonArtifact } from "./baseline.js";
import { formatPolicyEvaluationSection } from "./audit-policy-output.js";

function formatBaselineFindingLine(finding: Finding): string[] {
  const status = finding.baseline?.status?.toUpperCase() ?? "NEW";
  const lines = [
    `${finding.severity.toUpperCase()}  ${status}`,
    `${finding.ruleId}`,
    finding.title,
  ];
  const classification = finding.baseline?.classification;
  if (classification) {
    lines.push(classification.reason);
    if (classification.owner) {
      lines.push(`Owner: ${classification.owner}`);
    }
    if (classification.ticket) {
      lines.push(`Ticket: ${classification.ticket}`);
    }
    if (classification.expiresAt) {
      lines.push(`Expires: ${classification.expiresAt}`);
    }
    if (finding.baseline?.classificationExpired) {
      lines.push("Classification expired.");
    }
    if (finding.baseline?.regressionReason) {
      lines.push(`Regression: ${finding.baseline.regressionReason}`);
    }
  }
  return lines;
}

function formatResolvedFindingLine(finding: ResolvedFinding): string[] {
  const location =
    finding.location.kind === "flow-checkpoint"
      ? `${finding.location.flowId}/${finding.location.checkpointId}`
      : finding.location.route;
  return [
    `${finding.previousSeverity.toUpperCase()}  RESOLVED`,
    `${finding.ruleId}`,
    finding.snapshot?.title ?? location,
  ];
}

function formatBaselineSummaryHuman(
  summary: BaselineSummary,
  resolvedFindings: ResolvedFinding[] = [],
): string[] {
  const lines = [...formatBaselineComparisonArtifact(summary)];

  const regressed = summary.regressedFindings;
  const newCount = summary.newFindings;
  if (newCount === 0 && regressed === 0 && resolvedFindings.length === 0) {
    return lines;
  }

  for (const finding of resolvedFindings.slice(0, 5)) {
    lines.push(...formatResolvedFindingLine(finding));
    lines.push("");
  }

  return lines;
}

function formatReportsSection(
  result: AuditExecutionResult,
  options?: {
    sarifExternalPath?: string;
    junitExternalPath?: string;
    markdownExternalPath?: string;
    githubAnnotationsExternalPath?: string;
    githubStepSummaryWritten?: boolean;
  },
): string[] {
  if (!result.auditId && !result.artifacts?.resultsPath) {
    return [];
  }

  const lines: string[] = ["Reports", ""];
  if (result.auditId) {
    lines.push(`Audit ID: ${result.auditId}`);
  }
  lines.push(`HTML report: ${result.artifacts?.reportPath ?? "not generated"}`);
  if (options?.markdownExternalPath) {
    lines.push(`Markdown report: ${options.markdownExternalPath}`);
    if (result.artifacts?.markdownPath) {
      lines.push(`Bundle copy: ${result.artifacts.markdownPath}`);
    }
  } else {
    lines.push(`Markdown report: ${result.artifacts?.markdownPath ?? "not generated"}`);
  }
  if (result.artifacts?.resultsPath) {
    lines.push(`JSON report: ${result.artifacts.resultsPath}`);
  }
  if (result.artifacts?.sarifPath) {
    if (options?.sarifExternalPath) {
      lines.push(`SARIF report: ${options.sarifExternalPath}`);
      lines.push(`Bundle copy: ${result.artifacts.sarifPath}`);
    } else {
      lines.push(`SARIF report: ${result.artifacts.sarifPath}`);
    }
  }
  if (result.artifacts?.junitPath) {
    if (options?.junitExternalPath) {
      lines.push(`JUnit report: ${options.junitExternalPath}`);
      lines.push(`Bundle copy: ${result.artifacts.junitPath}`);
    } else {
      lines.push(`JUnit report: ${result.artifacts.junitPath}`);
    }
  }
  if (result.artifacts?.githubAnnotationsPath) {
    if (options?.githubAnnotationsExternalPath) {
      lines.push(`GitHub annotations: ${options.githubAnnotationsExternalPath}`);
      lines.push(`Bundle copy: ${result.artifacts.githubAnnotationsPath}`);
    } else {
      lines.push(`GitHub annotations: ${result.artifacts.githubAnnotationsPath}`);
    }
  }
  if (options?.githubStepSummaryWritten) {
    lines.push("GitHub step summary: written");
  }
  lines.push("");
  return lines;
}

export type FormatAuditHumanOptions = AuditPresentationOptions & {
  explicitCiFlagsUsed?: boolean;
  minimumSeverity?: Severity;
  sarifExternalPath?: string;
  junitExternalPath?: string;
  markdownExternalPath?: string;
  githubAnnotationsExternalPath?: string;
  githubStepSummaryWritten?: boolean;
};

export function formatAuditHuman(
  result: AuditExecutionResult,
  options?: FormatAuditHumanOptions,
): string {
  const blocks: string[] = [checkingMessage(), ""];

  blocks.push(...formatAuditExecutionHeader(result, formatLabelValue));

  if (hasFlowExecutions(result)) {
    blocks.push(...formatFlowExecutionsHuman(result));
  }

  blocks.push(
    ...formatAuditFindingsPresentation(result.findings, {
      colorMode: options?.colorMode,
      capabilities: options?.capabilities,
      presentationMode: options?.presentationMode,
      terminalWidth: options?.terminalWidth,
      verbose: options?.verbose,
    }),
  );

  blocks.push(
    ...formatAuditRunSummaries(result.runs, {
      skipFlowCheckpoints: hasFlowExecutions(result),
    }),
  );

  if (result.baselineSummary?.baselineUsed) {
    blocks.push(
      ...formatBaselineSummaryHuman(
        result.baselineSummary,
        result.resolvedFindings ?? [],
      ),
    );
    for (const finding of result.findings) {
      const status = finding.baseline?.status;
      if (status === "new" || status === "regressed") {
        blocks.push(...formatBaselineFindingLine(finding));
        blocks.push("");
      }
    }
    if (result.baselineSummary.baselinePath) {
      blocks.push(formatLabelValue("Baseline", result.baselineSummary.baselinePath));
      blocks.push("");
    }
    blocks.push("A baseline records known accessibility debt.");
    blocks.push("It does not make that debt accessible or compliant.");
    blocks.push("");
  }

  if (result.policyEvaluation) {
    const minimumSeverity = options?.minimumSeverity ?? "high";
    blocks.push(
      ...formatPolicyEvaluationSection(result.policyEvaluation, {
        explicitCiFlagsUsed: options?.explicitCiFlagsUsed,
        minimumSeverity,
        findings: result.findings,
      }),
    );
    if (result.policyEvaluation.policyEnabled || options?.explicitCiFlagsUsed) {
      blocks.push("");
    }
  }

  blocks.push(...formatProfileReviewSections(result));
  blocks.push(...formatAuditFooterSummary(result));
  blocks.push(...formatReportsSection(result, options));

  const errorDiagnostics = result.diagnostics.filter((d) => d.severity === "error");
  if (errorDiagnostics.length > 0) {
    blocks.push("Errors:");
    for (const diagnostic of errorDiagnostics) {
      blocks.push(`- [${diagnostic.code}] ${diagnostic.message}`);
      if (diagnostic.hint) {
        blocks.push(`  Hint: ${diagnostic.hint}`);
      }
    }
    blocks.push("");
  }

  for (const limitation of result.limitations) {
    blocks.push(limitation);
  }

  return blocks.join("\n").trimEnd();
}

export function formatAuditJson(result: AuditExecutionResult): unknown {
  return result;
}

export {
  buildFindingGroupKey,
  countUniqueIssues,
  groupFindings,
} from "../presentation/audit-presentation.js";
