import type { AuditRunResult, Finding, FindingLocation, PolicyBreach } from "@a11yst/types";
import type { MarkdownReportInput } from "../markdown/types.js";

export type GitHubAnnotationLevel = "error" | "warning" | "notice";

export type GitHubAnnotation = {
  level: GitHubAnnotationLevel;
  title: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  fingerprint?: string;
};

export type GitHubAnnotationInput = MarkdownReportInput & {
  runs?: AuditRunResult[];
};

export type GitHubAnnotationOptions = {
  maxAnnotations?: number;
};

export type GitHubAnnotationDiagnosticCode =
  | "truncated-annotations"
  | "invalid-source-location"
  | "redacted-content";

export type GitHubAnnotationDiagnostic = {
  code: GitHubAnnotationDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
};

export type GitHubAnnotationGenerationResult = {
  annotations: GitHubAnnotation[];
  commands: string;
  summary: {
    annotations: number;
    errors: number;
    warnings: number;
    notices: number;
    truncated: number;
  };
  diagnostics: GitHubAnnotationDiagnostic[];
};

export function formatBreachLocation(location: FindingLocation): string {
  if (location.kind === "route") {
    return `route ${location.route}`;
  }
  return `flow ${location.flowId} / ${location.checkpointId}`;
}

export function breachMessage(breach: PolicyBreach): string {
  const prefix =
    breach.kind === "new-finding"
      ? "New"
      : breach.kind === "regressed-finding"
        ? "Regressed"
        : "Expired classification breach for";
  return `${prefix} ${breach.severity} accessibility finding in ${breach.projectName} at ${formatBreachLocation(breach.location)}. Fingerprint: ${breach.fingerprint.slice(0, 8)}.`;
}

export function findingByFingerprint(
  findings: Finding[],
  fingerprint: string,
): Finding | undefined {
  return findings.find((finding) => finding.fingerprint === fingerprint);
}
