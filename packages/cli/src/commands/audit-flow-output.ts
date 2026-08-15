import type {
  AuditExecutionResult,
  AuditRunResult,
  Finding,
  FlowTrace,
} from "@a11yst/types";

function sanitizeLocatorDescription(description: string): string {
  return description.replace(/\[REDACTED\]/g, "[REDACTED]");
}

function stepDescription(step: FlowTrace["steps"][number]): string {
  if (step.locator?.description) {
    return `${step.action} ${sanitizeLocatorDescription(step.locator.description)}`;
  }
  if (step.action === "goto") {
    return "goto";
  }
  if (step.action === "press") {
    const key = "key" in step && typeof step.key === "string" ? step.key : step.action;
    return `press ${key}`;
  }
  if (step.checkpointName || step.checkpointId) {
    return step.checkpointName ?? step.checkpointId ?? "checkpoint";
  }
  return step.action;
}

function formatFlowTrace(
  trace: FlowTrace,
  runs: AuditRunResult[],
): string[] {
  const lines: string[] = [];
  const sessionRuns = runs.filter(
    (run) =>
      run.kind === "flow-checkpoint" &&
      run.flowId === trace.flowId &&
      run.profile === trace.profile &&
      run.viewport?.name === trace.viewport,
  );
  const checkpointFindings = new Map<string, Finding[]>();
  for (const run of sessionRuns) {
    if (run.checkpointId) {
      checkpointFindings.set(run.checkpointId, run.findings);
    }
  }

  lines.push(`FLOW  ${trace.flowId}`);
  lines.push(`VIEW  ${trace.viewport}`);
  lines.push(`PROFILE ${trace.profile}`);
  lines.push("");

  const totalSteps = trace.steps.length;
  for (const step of trace.steps) {
    const stepNum = step.index + 1;
    if (step.action === "checkpoint") {
      const checkpointId = step.checkpointId ?? step.checkpointName ?? "checkpoint";
      const findings = checkpointFindings.get(checkpointId) ?? [];
      const statusLabel =
        step.status === "completed"
          ? findings.length > 0
            ? "ISSUES"
            : "PASS"
          : step.status === "skipped"
            ? "SKIPPED"
            : "ERROR";

      lines.push(`CHECKPOINT  ${checkpointId}`);
      if (statusLabel === "PASS") {
        lines.push("PASS        No automated barriers found");
      } else if (statusLabel === "SKIPPED") {
        lines.push("SKIPPED");
        const reason = step.failureReason ?? step.diagnostics[0]?.message;
        if (reason) {
          lines.push(`Reason: ${reason}`);
        }
      } else if (findings.length > 0) {
        const automated = findings.filter(
          (f) => (f.automation ?? "automated") === "automated",
        ).length;
        const heuristic = findings.filter((f) => f.automation === "heuristic").length;
        const review = findings.filter((f) => f.automation === "manual-review").length;
        const parts: string[] = [];
        if (automated > 0) {
          parts.push(`${automated} automated barrier${automated === 1 ? "" : "s"}`);
        }
        if (heuristic > 0) {
          parts.push(`${heuristic} heuristic finding${heuristic === 1 ? "" : "s"}`);
        }
        if (review > 0) {
          parts.push(`${review} generated manual check${review === 1 ? "" : "s"}`);
        }
        lines.push(`ISSUES      ${parts.join("; ")}`);
      } else {
        lines.push(`ERROR       ${step.failureReason ?? "Checkpoint step failed"}`);
      }
      lines.push("");
      continue;
    }

    const label = step.status === "completed" ? "PASS" : step.status === "skipped" ? "SKIPPED" : "ERROR";
    lines.push(`STEP  ${stepNum}/${totalSteps}  ${stepDescription(step)}`);
    lines.push(label);
    if (step.status === "skipped" || step.status === "failed") {
      const reason = step.failureReason ?? step.diagnostics[0]?.message;
      if (reason) {
        lines.push(`Reason: ${reason.replace(/\[REDACTED\]/g, "[REDACTED]")}`);
      }
    }
    lines.push("");
  }

  lines.push(`Flow ${trace.status === "completed" ? "completed" : "failed"}`);
  lines.push("");
  return lines;
}

export function formatFlowExecutionsHuman(
  result: AuditExecutionResult,
): string[] {
  if (!result.flowExecutions || result.flowExecutions.length === 0) {
    return [];
  }

  const blocks: string[] = [];
  for (const trace of result.flowExecutions) {
    blocks.push(...formatFlowTrace(trace, result.runs));
  }

  if (result.flowSummary) {
    blocks.push("Flows summary");
    blocks.push(`Configured flows     ${result.flowSummary.configuredFlows}`);
    blocks.push(`Completed flows      ${result.flowSummary.completedFlows}`);
    blocks.push(`Failed flows         ${result.flowSummary.failedFlows}`);
    blocks.push(`Completed checkpoints  ${result.flowSummary.completedCheckpoints}`);
    blocks.push(`Skipped checkpoints    ${result.flowSummary.skippedCheckpoints}`);
    blocks.push("");
  }

  return blocks;
}

export function hasFlowExecutions(result: AuditExecutionResult): boolean {
  return Boolean(result.flowExecutions && result.flowExecutions.length > 0);
}
