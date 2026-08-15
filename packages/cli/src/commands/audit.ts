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

function formatArtifactsSection(result: AuditExecutionResult): string[] {
  if (!result.auditId && !result.artifacts?.resultsPath) {
    return [];
  }

  const lines: string[] = ["Artifacts", ""];
  if (result.auditId) {
    lines.push(`Audit ID: ${result.auditId}`);
  }
  if (result.artifacts?.resultsPath) {
    lines.push(`JSON report: ${result.artifacts.resultsPath}`);
  }
  lines.push("");
  return lines;
}

export type FormatAuditHumanOptions = AuditPresentationOptions & {
  explicitCiFlagsUsed?: boolean;
  minimumSeverity?: Severity;
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
  blocks.push(...formatArtifactsSection(result));

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
