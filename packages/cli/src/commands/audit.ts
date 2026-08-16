import type { AuditExecutionResult, Severity } from "@a11yst/types";
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
import { formatPolicyEvaluationSection } from "./audit-policy-output.js";

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
