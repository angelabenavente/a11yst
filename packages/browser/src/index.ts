/**
 * Playwright + axe-core web audit engine for a11yst.
 *
 * This package has no dependency on Commander or any CLI output formatting
 * — `runWebAudit` is a plain async function consumed by `@a11yst/cli` (or
 * any other caller) that returns fully serialisable results.
 */
export { runWebAudit, type RunWebAuditOptions, type WebAuditBatchResult } from "./run-web-audit.js";
export { runFlowAudit, type RunFlowAuditOptions, type FlowAuditBatchResult } from "./run-flow-audit.js";

export { buildPageUrl } from "./url.js";

export {
  mapAxeImpactToSeverity,
  normalizeAxeViolations,
  sortFindings,
  createFindingId,
  createFindingFingerprint,
  sanitizeHtmlSnippet,
  type AxeNodeResultLike,
  type AxeViolationLike,
  type AxeNormalizationContext,
  type FindingKeyParts,
} from "./axe-normalize.js";

export { DevServerManager, type EnsureReadyOptions, type EnsureReadyResult } from "./dev-server.js";

export {
  withBrowser,
  BrowserAuditError,
  buildContextOptions,
  normalizeViewport,
  capturePageEvidence,
  type BrowserSession,
  type BrowserSessionOptions,
  type BrowserEvidenceOptions,
  type EvidenceSink,
  type BrowserErrorKind,
  type PageAuditParams,
  type PageAuditOutcome,
  type PageEvidenceCaptureResult,
} from "./browser.js";
export {
  applyPageReadiness,
  mergeRunReadiness,
  ReadinessError,
  type MergedReadinessConfig,
} from "./readiness.js";
export {
  assertConfiguredTargetOrigin,
  originOf,
  sanitizeUrlForDiagnostics,
  TargetOriginMismatchError,
  targetOriginMismatchDiagnostic,
} from "@a11yst/profiles";
