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
export { applySourceAnalysis } from "./apply-source-analysis.js";
export { applyPolicyEvaluation } from "./policy-evaluation.js";
export {
  buildReportManifestEntry,
  buildReportsManifest,
  buildJunitReportReference,
  buildMarkdownReportReference,
  buildGitHubAnnotationsReportReference,
  buildGitHubStepSummaryReference,
  buildSarifReportReference,
  mergeReportReferences,
} from "./report-manifest.js";
export { createMarkdownInputFromAuditResult } from "./create-markdown-input.js";
export { createGitHubAnnotationsInputFromAuditResult } from "./create-github-annotations-input.js";
export {
  generateMarkdownReportArtifact,
  generateMarkdownContentFromAuditResult,
  shouldGenerateMarkdownForAuditResult,
  type GenerateMarkdownReportOptions,
  type GenerateMarkdownReportOutput,
} from "./generate-markdown-report.js";
export {
  generateGitHubAnnotationsReport,
  shouldGenerateGitHubAnnotationsForAuditResult,
  type GenerateGitHubAnnotationsReportOptions,
  type GenerateGitHubAnnotationsReportOutput,
} from "./generate-github-annotations-report.js";
export {
  resolveMarkdownReportOptions,
  type ResolvedMarkdownReportOptions,
  type MarkdownReportCliOptions,
} from "./resolve-markdown-report-options.js";
export {
  resolveGitHubAnnotationsOptions,
  resolveGitHubStepSummaryOptions,
  type ResolvedGitHubAnnotationsOptions,
  type GitHubAnnotationsCliOptions,
  type GitHubStepSummaryCliOptions,
} from "./resolve-github-report-options.js";
export { createJunitInputFromAuditResult } from "./create-junit-input.js";
export {
  generateJunitReport,
  shouldGenerateJunitForAuditResult,
  type GenerateJunitReportOptions,
  type GenerateJunitReportOutput,
} from "./generate-junit-report.js";
export {
  resolveJunitReportOptions,
  type ResolvedJunitReportOptions,
  type JunitReportCliOptions,
} from "./resolve-junit-report-options.js";
export { createSarifInputFromAuditResult } from "./create-sarif-input.js";
export {
  generateSarifReport,
  shouldGenerateSarifForAuditResult,
  type GenerateSarifReportOptions,
  type GenerateSarifReportOutput,
} from "./generate-sarif-report.js";
export {
  resolveSarifReportOptions,
  type ResolvedSarifReportOptions,
  type SarifReportCliOptions,
} from "./resolve-sarif-report-options.js";
