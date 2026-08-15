import type { Finding, PolicyBreach, PolicyEvaluationResult, Severity } from "@a11yst/types";
import { formatSeverityLabel } from "@a11yst/types";
import { formatLabelValue } from "../output.js";

const BREACH_KIND_LABEL: Record<PolicyBreach["kind"], string> = {
  "new-finding": "NEW",
  "regressed-finding": "REGRESSED",
  "expired-classification": "EXPIRED CLASSIFICATION",
};

function formatPolicyStatus(status: PolicyEvaluationResult["status"]): string {
  if (status === "passed") return "PASSED";
  if (status === "failed") return "FAILED";
  if (status === "not-evaluated") return "NOT EVALUATED";
  return status;
}

function formatBreachLocation(breach: PolicyBreach): string[] {
  const location = breach.location;
  const lines: string[] = [];

  lines.push(formatLabelValue("Project", breach.projectName));

  if (location.kind === "route") {
    lines.push(formatLabelValue("Route", location.route));
  } else {
    lines.push(formatLabelValue("Flow", location.flowId));
    lines.push(formatLabelValue("Checkpoint", location.checkpointId));
  }

  lines.push(formatLabelValue("Profile", location.profile));
  if (location.viewport) {
    lines.push(formatLabelValue("Viewport", location.viewport));
  }

  return lines;
}

function formatPolicyBreach(
  breach: PolicyBreach,
  findingByFingerprint?: Map<string, Finding>,
): string[] {
  const lines = [
    `${formatSeverityLabel(breach.severity)}  ${BREACH_KIND_LABEL[breach.kind]}`,
    breach.ruleId,
    ...formatBreachLocation(breach),
    formatLabelValue("Fingerprint", breach.fingerprint),
  ];

  if (breach.reason) {
    lines.push(`Reason: ${breach.reason}`);
  }

  const relatedFinding = findingByFingerprint?.get(breach.fingerprint);
  const classification = relatedFinding?.baseline?.classification;

  if (classification?.owner) {
    lines.push(`Owner: ${classification.owner}`);
  }
  if (classification?.expiresAt && breach.kind === "expired-classification") {
    lines.push(`Expired: ${classification.expiresAt}`);
  } else if (breach.disposition) {
    lines.push(formatLabelValue("Disposition", breach.disposition));
  }

  return lines;
}

export function formatPolicyEvaluationHuman(
  evaluation: PolicyEvaluationResult,
  minimumSeverity: Severity,
  findings: Finding[] = [],
): string[] {
  const lines: string[] = ["CI policy", ""];

  lines.push(formatLabelValue("Status", formatPolicyStatus(evaluation.status)));
  lines.push(formatLabelValue("Minimum severity", formatSeverityLabel(minimumSeverity)));
  lines.push("");

  if (evaluation.status === "not-evaluated") {
    lines.push("The enabled CI policy requires a baseline comparison.");
    lines.push("Create or provide a baseline, or disable the policy explicitly.");
    return lines;
  }

  if (!evaluation.policyEnabled) {
    return lines;
  }

  const { summary } = evaluation;
  lines.push(formatLabelValue("New breaches", String(summary.newBreaches)));
  lines.push(formatLabelValue("Regression breaches", String(summary.regressionBreaches)));
  lines.push(
    formatLabelValue(
      "Expired classification breaches",
      String(summary.expiredClassificationBreaches),
    ),
  );
  lines.push(formatLabelValue("Total breaches", String(summary.totalBreaches)));
  lines.push("");

  const findingByFingerprint = new Map(findings.map((finding) => [finding.fingerprint, finding]));

  for (const breach of evaluation.breaches) {
    lines.push(...formatPolicyBreach(breach, findingByFingerprint));
    lines.push("");
  }

  return lines;
}

export function formatPolicyDisabledHint(): string[] {
  return ["CI policy disabled (no blocking gates enabled)."];
}

export function formatPolicyEvaluationSection(
  evaluation: PolicyEvaluationResult,
  options: {
    explicitCiFlagsUsed?: boolean;
    minimumSeverity: Severity;
    findings?: Finding[];
  },
): string[] {
  if (!evaluation.policyEnabled) {
    if (options.explicitCiFlagsUsed) {
      return formatPolicyDisabledHint();
    }
    return [];
  }

  return formatPolicyEvaluationHuman(
    evaluation,
    options.minimumSeverity,
    options.findings ?? [],
  );
}
