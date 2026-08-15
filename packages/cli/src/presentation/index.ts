export { createBrandHeader, createPlainBrandHeader } from "./brand-header.js";
export { resolveTerminalCapabilities } from "./capabilities.js";
export { shouldRenderBranding } from "./boundary.js";
export { AUDIT_HELP_DISCLAIMER } from "./disclaimers.js";
export { prependHumanBrandHeader } from "./human-output.js";
export { resolveTerminalPresentationMode } from "./mode.js";
export {
  formatHumanHint,
  formatHumanStatus,
  HUMAN_STATUS_LABELS,
  type HumanStatusKind,
} from "./status.js";
export type { ColorMode } from "./color.js";
export { parseColorMode, resolveColorEnabled } from "./color.js";
export {
  parseProgressMode,
  resolveProgressAnimationEnabled,
  resolveProgressModeFromCli,
  resolveProgressStaticEnabled,
  type ProgressMode,
} from "./progress-mode.js";
export { createProgressReporter, stopActiveProgressReporter } from "./progress-reporter.js";
export { registerProgressSignalHandlers } from "./progress-signals.js";
export {
  buildFindingGroupKey,
  countUniqueIssues,
  formatAuditExecutionHeader,
  formatAuditFindingsPresentation,
  formatAuditFooterSummary,
  formatAuditRunSummaries,
  formatProfileReviewSections,
  groupFindings,
  type AuditPresentationOptions,
  type FindingGroup,
} from "./audit-presentation.js";
export type {
  BrandHeaderOptions,
  OutputKind,
  TerminalCapabilities,
  TerminalCapabilitiesInput,
  TerminalPresentationMode,
} from "./types.js";
