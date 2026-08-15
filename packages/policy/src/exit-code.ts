import type { PolicyEvaluationResult } from "@a11yst/types";

export type AuditExitCodeInput = {
  /** True when the audit failed operationally (config, browser, persistence, etc.). */
  operationalError?: boolean;
  /** True when the audit did not complete successfully. */
  auditIncomplete?: boolean;
  policyEvaluation?: PolicyEvaluationResult;
};

/**
 * Map audit completion and policy evaluation to process exit codes.
 *
 * - 0: audit completed and policy disabled or passed
 * - 1: operational/config error, audit incomplete, or policy not evaluable
 * - 2: audit completed but CI policy failed
 */
export function getAuditExitCode(input: AuditExitCodeInput): 0 | 1 | 2 {
  if (input.operationalError || input.auditIncomplete) {
    return 1;
  }

  const evaluation = input.policyEvaluation;
  if (!evaluation) {
    return 0;
  }

  if (evaluation.status === "not-evaluated") {
    return 1;
  }

  if (evaluation.status === "failed") {
    return 2;
  }

  return 0;
}
