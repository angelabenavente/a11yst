export type { PolicyEvaluationInput } from "./evaluate.js";
export {
  evaluateCiPolicy,
  isPolicyEnabled,
  isPolicyExcludedDisposition,
  isSeverityAtLeast,
} from "./evaluate.js";
export { SEVERITY_ORDER, severityRank, compareSeverityDescending } from "./severity.js";
export { dedupeFindings, mergeDuplicateFinding } from "./dedupe.js";
export { resolveCiPolicyConfig, isValidMinimumSeverity } from "./resolve.js";
export type { CiPolicyCliOverrides } from "./resolve.js";
export { getAuditExitCode } from "./exit-code.js";
export type { AuditExitCodeInput } from "./exit-code.js";
