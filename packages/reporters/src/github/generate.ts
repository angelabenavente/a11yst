import type { AuditRunResult, PolicyBreach, Severity } from "@a11yst/types";
import { serializeGitHubAnnotationCommand } from "./escape.js";
import { annotationFromFinding } from "./source-location.js";
import type {
  GitHubAnnotation,
  GitHubAnnotationDiagnostic,
  GitHubAnnotationGenerationResult,
  GitHubAnnotationInput,
  GitHubAnnotationOptions,
} from "./types.js";
import { breachMessage as formatBreachMessage, findingByFingerprint } from "./types.js";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "minor"];
const DEFAULT_MAX_ANNOTATIONS = 50;

type Candidate = {
  priority: number;
  annotation: GitHubAnnotation;
};

function breachPriority(breach: PolicyBreach): number {
  const severityBase = SEVERITY_ORDER.indexOf(breach.severity) * 10;
  switch (breach.kind) {
    case "new-finding":
      return 100 + severityBase;
    case "regressed-finding":
      return 200 + severityBase;
    case "expired-classification":
      return 300 + severityBase;
  }
}

function sortCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const title = a.annotation.title.localeCompare(b.annotation.title);
    if (title !== 0) return title;
    return (a.annotation.fingerprint ?? "").localeCompare(b.annotation.fingerprint ?? "");
  });
}

function operationalCandidates(
  runs: AuditRunResult[] | undefined,
  diagnostics: GitHubAnnotationDiagnostic[],
): Candidate[] {
  if (!runs) return [];
  const candidates: Candidate[] = [];
  for (const run of runs) {
    if (run.status !== "failed") continue;
    const message =
      run.diagnostics.find((entry) => entry.severity === "error")?.message ??
      run.skipReason ??
      "Audit run failed.";
    const route = run.route ?? run.flowId ?? "run";
    candidates.push({
      priority: 0,
      annotation: {
        level: "error",
        title: `a11yst: ${route}`,
        message: message.replace(/\s+/g, " ").trim(),
        fingerprint: run.runId,
      },
    });
    if (/password|token|authorization|cookie/i.test(message)) {
      diagnostics.push({
        code: "redacted-content",
        level: "info",
        message: "Operational annotation message may contain sensitive content.",
      });
    }
  }
  return candidates;
}

export function generateGitHubAnnotations(
  input: GitHubAnnotationInput,
  options: GitHubAnnotationOptions = {},
): GitHubAnnotationGenerationResult {
  const diagnostics: GitHubAnnotationDiagnostic[] = [];
  const maxAnnotations = options.maxAnnotations ?? DEFAULT_MAX_ANNOTATIONS;
  const candidates: Candidate[] = operationalCandidates(input.runs, diagnostics);

  const evaluation = input.policyEvaluation;
  if (evaluation?.policyEnabled && evaluation.status === "not-evaluated") {
    const message =
      evaluation.diagnostics.find((entry) => entry.level === "error")?.message ??
      evaluation.diagnostics[0]?.message ??
      "The enabled CI policy requires a baseline comparison.";
    candidates.push({
      priority: 1,
      annotation: {
        level: "error",
        title: "a11yst CI policy was not evaluated",
        message,
      },
    });
  } else if (evaluation?.policyEnabled && evaluation.status === "failed") {
    for (const breach of evaluation.breaches) {
      const finding = findingByFingerprint(input.findings, breach.fingerprint);
      candidates.push({
        priority: breachPriority(breach),
        annotation: annotationFromFinding(
          finding,
          "error",
          `a11yst: ${breach.ruleId}`,
          formatBreachMessage(breach),
          breach.fingerprint,
          diagnostics,
        ),
      });
    }
  }

  const sorted = sortCandidates(candidates);
  const truncated = Math.max(0, sorted.length - maxAnnotations);
  let selected = sorted.slice(0, maxAnnotations);
  if (truncated > 0) {
    diagnostics.push({
      code: "truncated-annotations",
      level: "info",
      message: `GitHub annotations truncated to ${maxAnnotations}.`,
    });
    if (selected.length < maxAnnotations) {
      selected = sorted.slice(0, maxAnnotations);
    } else {
      selected = sorted.slice(0, maxAnnotations - 1);
      selected.push({
        priority: 9999,
        annotation: {
          level: "notice",
          title: "a11yst annotations truncated",
          message: `${truncated} additional annotations were not emitted.`,
        },
      });
    }
  }

  const annotations = selected.map((candidate) => candidate.annotation);
  const commands =
    annotations.length === 0
      ? ""
      : `${annotations
          .map((annotation) =>
            serializeGitHubAnnotationCommand({
              level: annotation.level,
              title: annotation.title,
              message: annotation.message,
              ...(annotation.file ? { file: annotation.file } : {}),
              ...(annotation.line !== undefined ? { line: annotation.line } : {}),
              ...(annotation.column !== undefined ? { column: annotation.column } : {}),
              ...(annotation.endLine !== undefined ? { endLine: annotation.endLine } : {}),
              ...(annotation.endColumn !== undefined ? { endColumn: annotation.endColumn } : {}),
            }),
          )
          .join("\n")}\n`;

  const summary = {
    annotations: annotations.length,
    errors: annotations.filter((annotation) => annotation.level === "error").length,
    warnings: annotations.filter((annotation) => annotation.level === "warning").length,
    notices: annotations.filter((annotation) => annotation.level === "notice").length,
    truncated,
  };

  return {
    annotations,
    commands,
    summary,
    diagnostics: [...diagnostics].sort((a, b) => {
      const byCode = a.code.localeCompare(b.code);
      return byCode !== 0 ? byCode : a.message.localeCompare(b.message);
    }),
  };
}
