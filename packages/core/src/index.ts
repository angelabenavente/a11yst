/**
 * Core orchestrator for a11yst audit planning and execution.
 *
 * Planning (`createAuditPlan`) builds deterministic project × route ×
 * profile × viewport combinations. Execution (`executeAudit`) selects which
 * of those planned runs are executable and drives `@a11yst/browser`.
 */
export { createAuditPlan, freezeAuditPlan } from "./create-audit-plan.js";
export { buildRunId } from "./run-id.js";
export {
  prepareAuditConfig,
  resolveProjectRoutesForProject,
  type ResolveProjectRoutesForProjectResult,
} from "./resolve-project-routes.js";
export {
  isExecutableRun,
  isFlowCheckpointRun,
  isRouteRun,
  selectRuns,
  skipReasonForRun,
  UnknownProfileError,
  UnknownProjectError,
  UnknownFlowError,
  AuditSelectionError,
  type SelectRunsOptions,
  type SelectRunsResult,
} from "./select-runs.js";
export {
  aggregateSummary,
  buildProfileSummary,
  buildFlowSummary,
  emptySeverityCounts,
  sortRunResults,
} from "./aggregate.js";
export {
  createArtifactEvidenceSink,
  createFlowEvidenceSink,
  executeAudit,
  resolveAuditOutputDirectory,
  type ExecuteAuditOptions,
} from "./execute-audit.js";
export {
  applyBaselineComparison,
  type ApplyBaselineComparisonOptions,
  type ApplyBaselineComparisonOutput,
} from "./baseline-comparison.js";
