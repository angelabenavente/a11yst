import type {
  AuditReportManifest,
  AuditReportReferences,
  GitHubAnnotationsReportManifestEntry,
  GitHubAnnotationsReportResultReference,
  JunitReportManifestEntry,
  JunitReportResultReference,
  MarkdownReportManifestEntry,
  MarkdownReportResultReference,
  SarifReportManifestEntry,
  SarifReportResultReference,
} from "@a11yst/types";

export function buildReportManifestEntry(
  reportGenerated: boolean,
  reportPath: string | undefined,
  sarifEntry?: SarifReportManifestEntry,
  junitEntry?: JunitReportManifestEntry,
  markdownEntry?: MarkdownReportManifestEntry,
  githubAnnotationsEntry?: GitHubAnnotationsReportManifestEntry,
  githubStepSummaryWritten?: boolean,
): AuditReportManifest | undefined {
  const reports: AuditReportManifest = {};
  if (reportGenerated && reportPath) {
    reports.html = { path: reportPath };
  }
  if (sarifEntry) {
    reports.sarif = sarifEntry;
  }
  if (junitEntry) {
    reports.junit = junitEntry;
  }
  if (markdownEntry) {
    reports.markdown = markdownEntry;
  }
  if (githubAnnotationsEntry) {
    reports.githubAnnotations = githubAnnotationsEntry;
  }
  if (githubStepSummaryWritten) {
    reports.githubStepSummary = { written: true };
  }
  return Object.keys(reports).length > 0 ? reports : undefined;
}

export function buildReportsManifest(input: {
  html?: { path: string };
  sarif?: SarifReportManifestEntry;
  junit?: JunitReportManifestEntry;
  markdown?: MarkdownReportManifestEntry;
  githubAnnotations?: GitHubAnnotationsReportManifestEntry;
  githubStepSummary?: { written: boolean };
}): AuditReportManifest | undefined {
  const reports: AuditReportManifest = {};
  if (input.html) {
    reports.html = input.html;
  }
  if (input.sarif) {
    reports.sarif = input.sarif;
  }
  if (input.junit) {
    reports.junit = input.junit;
  }
  if (input.markdown) {
    reports.markdown = input.markdown;
  }
  if (input.githubAnnotations) {
    reports.githubAnnotations = input.githubAnnotations;
  }
  if (input.githubStepSummary) {
    reports.githubStepSummary = input.githubStepSummary;
  }
  return Object.keys(reports).length > 0 ? reports : undefined;
}

export function mergeReportReferences(
  current: AuditReportReferences | undefined,
  patch: AuditReportReferences,
): AuditReportReferences {
  return {
    ...(current ?? {}),
    ...patch,
  };
}

export function buildSarifReportReference(
  reference: SarifReportResultReference,
): AuditReportReferences {
  return { sarif: reference };
}

export function buildJunitReportReference(
  reference: JunitReportResultReference,
): AuditReportReferences {
  return { junit: reference };
}

export function buildMarkdownReportReference(
  reference: MarkdownReportResultReference,
): AuditReportReferences {
  return { markdown: reference };
}

export function buildGitHubAnnotationsReportReference(
  reference: GitHubAnnotationsReportResultReference,
): AuditReportReferences {
  return { githubAnnotations: reference };
}

export function buildGitHubStepSummaryReference(): AuditReportReferences {
  return { githubStepSummary: { written: true } };
}
