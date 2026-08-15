import type { Severity } from "@a11yst/types";
import type { PolicyEvaluationResult, PolicyBreach } from "@a11yst/types";
import type { JunitGenerationDiagnostic, JunitTestCase } from "./types.js";
import {
  fingerprintPrefix,
  MAX_BODY_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_TESTCASE_NAME_LENGTH,
  pushTruncatedDiagnostic,
  truncateText,
} from "./text.js";
import { sanitizeXmlString } from "./xml.js";

function breachKindLabel(kind: PolicyBreach["kind"]): string {
  switch (kind) {
    case "new-finding":
      return "new";
    case "regressed-finding":
      return "regression";
    case "expired-classification":
      return "expired-classification";
  }
}

function breachMessage(breach: PolicyBreach): string {
  const prefix =
    breach.kind === "new-finding"
      ? "New"
      : breach.kind === "regressed-finding"
        ? "Regressed"
        : "Expired classification breach for";
  return `${prefix} ${breach.severity} accessibility finding: ${breach.ruleId}`;
}

function breachBody(breach: PolicyBreach): string {
  const lines = [
    `Project: ${breach.projectName}`,
    breach.location.kind === "route"
      ? `Route: ${breach.location.route}`
      : `Flow: ${breach.location.flowId} / Checkpoint: ${breach.location.checkpointId}`,
    `Profile: ${breach.location.profile}`,
    `Severity: ${breach.severity}`,
    `Lifecycle: ${breach.lifecycleStatus}`,
    `Fingerprint: ${fingerprintPrefix(breach.fingerprint)}`,
  ];
  return lines.join("\n");
}

export function buildPolicyBreachTestCase(
  breach: PolicyBreach,
  diagnostics: JunitGenerationDiagnostic[],
): JunitTestCase {
  const name = truncateText(
    `policy / ${breachKindLabel(breach.kind)} / ${breach.ruleId} / ${fingerprintPrefix(breach.fingerprint)}`,
    MAX_TESTCASE_NAME_LENGTH,
  );
  const message = truncateText(sanitizeXmlString(breachMessage(breach)), MAX_MESSAGE_LENGTH);
  const content = truncateText(sanitizeXmlString(breachBody(breach)), MAX_BODY_LENGTH);
  if (name.truncated || message.truncated || content.truncated) {
    pushTruncatedDiagnostic(diagnostics, breach.fingerprint);
  }
  return {
    name: name.text,
    classname: `${breach.projectName}.policy`,
    failure: {
      type: "a11ystPolicyBreach",
      message: message.text,
      content: content.text,
    },
    fingerprint: breach.fingerprint,
  };
}

export function buildPolicyNotEvaluatedTestCase(
  evaluation: PolicyEvaluationResult,
  projectName: string,
  diagnostics: JunitGenerationDiagnostic[],
): JunitTestCase | undefined {
  if (evaluation.status !== "not-evaluated") {
    return undefined;
  }
  const messageSource =
    evaluation.diagnostics.find((entry) => entry.level === "error")?.message ??
    evaluation.diagnostics[0]?.message ??
    "The enabled CI policy could not be evaluated.";
  const message = truncateText(sanitizeXmlString(messageSource), MAX_MESSAGE_LENGTH);
  const content = truncateText(sanitizeXmlString(messageSource), MAX_BODY_LENGTH);
  if (message.truncated || content.truncated) {
    pushTruncatedDiagnostic(diagnostics, "policy / evaluation");
  }
  return {
    name: "policy / evaluation",
    classname: `${projectName}.policy`,
    error: {
      type: "a11ystPolicyNotEvaluated",
      message: message.text,
      content: content.text,
    },
  };
}

export function buildPolicySuiteProperties(
  evaluation: PolicyEvaluationResult | undefined,
  minimumSeverity?: Severity,
): Array<{ name: string; value: string }> {
  if (!evaluation) {
    return [{ name: "a11yst.policy.enabled", value: "false" }];
  }
  const properties: Array<{ name: string; value: string }> = [
    { name: "a11yst.policy.enabled", value: String(evaluation.policyEnabled) },
    { name: "a11yst.policy.status", value: evaluation.status },
    { name: "a11yst.policy.totalBreaches", value: String(evaluation.summary.totalBreaches) },
  ];
  if (evaluation.policyEnabled && minimumSeverity) {
    properties.push({
      name: "a11yst.policy.minimumSeverity",
      value: minimumSeverity,
    });
  }
  return properties.sort((a, b) => a.name.localeCompare(b.name));
}
