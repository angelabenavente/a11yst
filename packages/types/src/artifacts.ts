import type { NormalizedViewport } from "./config.js";

/** Element bounds in CSS pixels relative to the document. */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Evidence attached to a single accessibility finding. */
export interface FindingEvidence {
  /** Bundle-relative path to an element screenshot. */
  screenshot?: string;
  /** Bundle-relative path to the page screenshot containing the finding. */
  pageScreenshot?: string;
  boundingBox?: BoundingBox;
  htmlSnippet?: string;
}

/** Reference to structured profile evidence persisted in the audit bundle. */
export interface RunStructuredEvidenceRef {
  kind: "focus-sequence" | "layout-comparison" | "motion-comparison" | "screenshot";
  path?: string;
  data?: Record<string, unknown>;
}

/** Evidence and navigation metadata captured for one run. */
export interface RunEvidence {
  /** Bundle-relative path to the run screenshot. */
  screenshot?: string;
  documentTitle?: string;
  finalUrl?: string;
  httpStatus?: number;
  capturedAt: string;
  navigationDurationMs?: number;
  viewport: NormalizedViewport;
}

/**
 * User-facing paths returned after an audit bundle is written.
 *
 * Paths may be relative to the caller's working directory or absolute.
 * Paths stored inside a manifest are bundle-relative instead.
 */
/** Default bundle-relative SARIF artifact path. */
export const DEFAULT_SARIF_BUNDLE_PATH = "reports/a11yst.sarif";

/** Default bundle-relative JUnit artifact path. */
export const DEFAULT_JUNIT_BUNDLE_PATH = "reports/a11yst.junit.xml";

/** Default bundle-relative Markdown artifact path. */
export const DEFAULT_MARKDOWN_BUNDLE_PATH = "reports/a11yst.md";

/** Default bundle-relative GitHub annotations artifact path. */
export const DEFAULT_GITHUB_ANNOTATIONS_BUNDLE_PATH = "reports/github-annotations.txt";

export interface SarifReportManifestEntry {
  path: string;
  version: "2.1.0";
  rules: number;
  results: number;
  locatedResults: number;
  unlocatedResults: number;
}

export interface JunitReportManifestEntry {
  path: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  timeSeconds: number;
}

export interface MarkdownReportManifestEntry {
  path: string;
  findings: number;
  policyBreaches: number;
  truncatedFindings: number;
}

export interface GitHubAnnotationsReportManifestEntry {
  path: string;
  annotations: number;
  errors: number;
  warnings: number;
  notices: number;
  truncated: number;
}

export interface AuditReportManifest {
  html?: { path: string };
  sarif?: SarifReportManifestEntry;
  junit?: JunitReportManifestEntry;
  markdown?: MarkdownReportManifestEntry;
  githubAnnotations?: GitHubAnnotationsReportManifestEntry;
  githubStepSummary?: { written: boolean };
}

export interface SarifReportResultReference {
  path: string;
  version: "2.1.0";
  summary: {
    rules: number;
    results: number;
    locatedResults: number;
    unlocatedResults: number;
  };
}

export interface JunitReportResultReference {
  path: string;
  summary: {
    tests: number;
    failures: number;
    errors: number;
    skipped: number;
    timeSeconds: number;
  };
}

export interface MarkdownReportResultReference {
  path: string;
  summary: {
    findings: number;
    policyBreaches: number;
    truncatedFindings: number;
  };
}

export interface GitHubAnnotationsReportResultReference {
  path: string;
  summary: {
    annotations: number;
    errors: number;
    warnings: number;
    notices: number;
    truncated: number;
  };
}

export interface GitHubStepSummaryResultReference {
  written: boolean;
}

export interface AuditReportReferences {
  sarif?: SarifReportResultReference;
  junit?: JunitReportResultReference;
  markdown?: MarkdownReportResultReference;
  githubAnnotations?: GitHubAnnotationsReportResultReference;
  githubStepSummary?: GitHubStepSummaryResultReference;
}

export interface AuditArtifactReferences {
  outputDirectory: string;
  manifestPath: string;
  resultsPath: string;
  reportPath?: string;
  sarifPath?: string;
  junitPath?: string;
  markdownPath?: string;
  githubAnnotationsPath?: string;
  evidenceDirectory?: string;
  baselineComparisonPath?: string;
  latestPath: string;
}

/** Aggregate counts recorded in an artifact manifest. */
export interface AuditArtifactCounts {
  screenshots: number;
  findings: number;
  runs: number;
}

/** Portable metadata stored at the root of a persisted audit bundle. */
export interface AuditManifest {
  schemaVersion: string;
  auditId: string;
  createdAt: string;
  status: string;
  productVersion: string;
  /** User-provided config path when it is safe and useful to retain. */
  configPath?: string;
  projectRoot: string;
  /** Bundle-relative path to the serialized audit result. */
  resultsPath: string;
  /** Bundle-relative path to the generated report entry point. */
  reportPath?: string;
  /** Bundle-relative path to captured evidence. */
  evidenceDirectory?: string;
  projects: Array<{
    name: string;
    platform: string;
    framework: string;
  }>;
  artifactCounts: AuditArtifactCounts;
  /** Minimal CI policy summary when evaluation ran. */
  policy?: {
    status: "passed" | "failed" | "not-evaluated";
    policyEnabled: boolean;
    totalBreaches: number;
  };
  /** Generated report artifacts within the bundle. */
  reports?: AuditReportManifest;
}
