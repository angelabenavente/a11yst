import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuditExecutionResult } from "@a11yst/types";
import { renderReportScript, renderReportStyles } from "./assets.js";
import { renderHtmlReport } from "./html.js";
import { loadProfileEvidenceForReport } from "./profile-evidence.js";

export { renderReportScript, renderReportStyles } from "./assets.js";
export {
  renderHtmlReport,
  type RenderHtmlReportOptions,
} from "./html.js";
export {
  loadProfileEvidenceForReport,
  renderFocusSequenceBlock,
  renderLargeTextComparisonBlock,
  renderProfileEvidenceSection,
  type FocusSequenceEvidence,
  type LayoutComparisonEvidence,
  type LoadedProfileEvidence,
} from "./profile-evidence.js";
export {
  readAuditResult,
  validateAuditResultDocument,
} from "./validation.js";
export { generateMarkdownReport } from "./markdown/generate.js";
export type {
  MarkdownReportInput,
  MarkdownReportOptions,
  MarkdownReportResult,
  MarkdownReportDiagnostic,
  MarkdownReportDiagnosticCode,
  ReportReference,
} from "./markdown/types.js";
export { generateGitHubAnnotations } from "./github/generate.js";
export type {
  GitHubAnnotation,
  GitHubAnnotationInput,
  GitHubAnnotationOptions,
  GitHubAnnotationGenerationResult,
  GitHubAnnotationDiagnostic,
  GitHubAnnotationLevel,
} from "./github/types.js";
export {
  escapeMarkdownText,
  escapeMarkdownTableCell,
  escapeMarkdownLinkLabel,
  encodeMarkdownLinkTarget,
} from "./markdown/escape.js";
export {
  escapeGitHubCommandProperty,
  escapeGitHubCommandMessage,
  serializeGitHubAnnotationCommand,
} from "./github/escape.js";
export {
  buildFindingGroupKey,
  countUniqueIssues,
  groupFindings,
  type FindingGroup,
} from "./finding-groups.js";
export {
  formatReportSourceLocation,
  formatSafeReportSourceLocation,
  sanitizeSourceUriForReport,
  resolveFindingRecommendationSummary,
  resolveFindingReportSource,
} from "./finding-source-report.js";

export interface GenerateHtmlReportOptions {
  auditResult: AuditExecutionResult;
  outputDirectory: string;
  auditId?: string;
}

export interface GeneratedHtmlReport {
  indexPath: string;
  assets: string[];
}

export async function generateHtmlReport({
  auditResult,
  outputDirectory,
  auditId,
}: GenerateHtmlReportOptions): Promise<GeneratedHtmlReport> {
  const reportDirectory = join(outputDirectory, "report");
  const indexPath = join(reportDirectory, "index.html");
  const stylesPath = join(reportDirectory, "styles.css");
  const scriptPath = join(reportDirectory, "report.js");

  await mkdir(reportDirectory, { recursive: true });
  const loadedProfileEvidence = await loadProfileEvidenceForReport(
    outputDirectory,
    auditResult.runs,
  );
  await Promise.all([
    writeFile(
      indexPath,
      renderHtmlReport(auditResult, { auditId, loadedProfileEvidence }),
      "utf8",
    ),
    writeFile(stylesPath, renderReportStyles(), "utf8"),
    writeFile(scriptPath, renderReportScript(), "utf8"),
  ]);

  return {
    indexPath,
    assets: [stylesPath, scriptPath],
  };
}
