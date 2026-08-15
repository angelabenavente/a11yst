import { basename, isAbsolute, resolve } from "node:path";
import { createArtifactWriter, type ArtifactWriter } from "@a11yst/artifacts";
import {
  runWebAudit,
  runFlowAudit,
  sortFindings,
  type EvidenceSink,
} from "@a11yst/browser";
import type { FlowEvidenceSink } from "@a11yst/flows";
import { generateHtmlReport } from "@a11yst/reporters";
import type {
  AccessibilityProfile,
  AuditExecutionResult,
  AuditManifest,
  AuditPlan,
  AuditRunResult,
  Diagnostic,
  Finding,
  FlowTrace,
  JunitReportManifestEntry,
  MarkdownReportManifestEntry,
  PlannedRun,
  ProgressReporter,
  ResolvedCiPolicyConfig,
  ResolvedConfig,
  SarifReportManifestEntry,
} from "@a11yst/types";
import { productMetadata } from "@a11yst/types";
import { aggregateSummary, buildProfileSummary, buildFlowSummary, emptySeverityCounts, sortRunResults } from "./aggregate.js";
import { createAuditPlan } from "./create-audit-plan.js";
import { prepareAuditConfig } from "./resolve-project-routes.js";
import { applyBaselineComparison } from "./baseline-comparison.js";
import { applySourceAnalysis } from "./apply-source-analysis.js";
import { applyPolicyEvaluation } from "./policy-evaluation.js";
import {
  generateSarifReport,
  shouldGenerateSarifForAuditResult,
} from "./generate-sarif-report.js";
import {
  generateJunitReport,
  shouldGenerateJunitForAuditResult,
} from "./generate-junit-report.js";
import {
  generateMarkdownReportArtifact,
  shouldGenerateMarkdownForAuditResult,
} from "./generate-markdown-report.js";
import {
  buildReportManifestEntry,
  buildJunitReportReference,
  buildMarkdownReportReference,
  buildSarifReportReference,
  mergeReportReferences,
} from "./report-manifest.js";
import type { ResolvedSarifReportOptions } from "./resolve-sarif-report-options.js";
import type { ResolvedJunitReportOptions } from "./resolve-junit-report-options.js";
import type { ResolvedMarkdownReportOptions } from "./resolve-markdown-report-options.js";
import { selectRuns, skipReasonForRun, UnknownProfileError, UnknownProjectError, UnknownFlowError, isRouteRun, isFlowCheckpointRun } from "./select-runs.js";

export interface ExecuteAuditOptions {
  /** Run with a visible browser window instead of headless. */
  headed?: boolean;
  /** Per-navigation timeout in milliseconds. Forwarded to `@a11yst/browser`. */
  navigationTimeoutMs?: number;
  /** Never start a dev server; fail fast if nothing is already listening. */
  noStartServer?: boolean;
  /** Restrict execution to these project names (validated against the plan). */
  projectNames?: string[];
  /** Abort the whole audit (in-flight browser work included) when triggered. */
  signal?: AbortSignal;
  /** Artifact root override. Relative paths are resolved from `config.configDir`. */
  outputDir?: string;
  /** Generate the static HTML report. Defaults to `true`. */
  html?: boolean;
  /** Capture screenshot evidence. Defaults to `config.evidence.screenshots`. */
  screenshots?: boolean;
  /** Capture full-page screenshots. Defaults to `config.evidence.fullPage`. */
  fullPageScreenshots?: boolean;
  /** Persist the audit bundle. Defaults to `true`; intended as an internal/test opt-out. */
  writeArtifacts?: boolean;
  /** Deterministic artifact id injection for tests. */
  artifactAuditId?: string;
  /** Deterministic artifact timestamp injection for tests. */
  artifactNow?: Date;
  /** Restrict execution to these profile names (validated against configured profiles). */
  profileNames?: AccessibilityProfile[];
  /** Restrict execution to these flow ids (validated against configured flows). */
  flowNames?: string[];
  /** Audit only static route runs. */
  routesOnly?: boolean;
  /** Audit only flow checkpoint runs. */
  flowsOnly?: boolean;
  /** Per-step timeout in milliseconds for flow execution. */
  stepTimeoutMs?: number;
  /** Skip baseline comparison even when a baseline file exists. */
  noBaseline?: boolean;
  /** Compare against this baseline file instead of the configured default. */
  baselinePath?: string;
  /** Fail when `baselinePath` does not exist. */
  explicitBaselineRequired?: boolean;
  /** Resolved CI policy override; defaults to `config.ci`. */
  ciPolicy?: ResolvedCiPolicyConfig;
  /** Resolved SARIF report options from config and CLI. */
  sarif?: ResolvedSarifReportOptions;
  /** Absolute path for an additional SARIF copy resolved by the CLI. */
  sarifExternalOutputPath?: string;
  /** Resolved JUnit report options from config and CLI. */
  junit?: ResolvedJunitReportOptions;
  /** Absolute path for an additional JUnit copy resolved by the CLI. */
  junitExternalOutputPath?: string;
  /** Resolved Markdown report options from config and CLI. */
  markdown?: ResolvedMarkdownReportOptions;
  /** Absolute path for an additional Markdown copy resolved by the CLI. */
  markdownExternalOutputPath?: string;
  /** Optional CLI progress reporter for long-running phases. */
  progress?: ProgressReporter;
}

const LIMITATIONS: string[] = [
  "Automated checks do not establish accessibility conformance.",
  "Automated checks cover only part of accessibility. Manual review and testing with disabled users remain necessary.",
  "Accessibility profiles approximate test conditions. They do not reproduce the complete experience of disabled users or assistive technologies.",
  "The large-text profile uses injected text scaling and does not verify full 400% reflow.",
  "The keyboard profile traverses focus but does not operate every control or detect all focus indicator styles.",
  "The reduced-motion profile emulates prefers-reduced-motion but cannot judge essential motion automatically.",
];

function buildEnvironment(headed: boolean | undefined): AuditExecutionResult["environment"] {
  return {
    product: productMetadata.name,
    productVersion: productMetadata.version,
    nodeVersion: process.version,
    browser: "chromium",
    headed: headed ?? false,
  };
}

function diagnosticForSkippedRun(run: PlannedRun, reason: string): Diagnostic {
  return {
    code: "PROFILE_NOT_ENABLED",
    severity: "info",
    message: reason,
    path: `runs.${run.id}`,
  };
}

function skippedRunResult(run: PlannedRun): AuditRunResult {
  const reason = skipReasonForRun(run) ?? "This run is not executed in this phase.";
  return {
    runId: run.id,
    projectName: run.projectName,
    platform: run.platform,
    framework: run.framework,
    routeId: run.routeId,
    routeName: run.routeName,
    route: run.route?.path,
    url: run.baseUrl,
    profile: run.profile,
    viewport: run.viewport,
    status: "skipped",
    startedAt: new Date().toISOString(),
    durationMs: 0,
    findings: [],
    diagnostics: [diagnosticForSkippedRun(run, reason)],
    skipReason: reason,
    ...(run.adapter !== undefined ? { adapter: run.adapter } : {}),
  };
}

function groupRunsByProject(runs: PlannedRun[]): Map<string, PlannedRun[]> {
  const groups = new Map<string, PlannedRun[]>();
  for (const run of runs) {
    const existing = groups.get(run.projectName);
    if (existing) {
      existing.push(run);
    } else {
      groups.set(run.projectName, [run]);
    }
  }
  return groups;
}

/** Resolve the artifact root without depending on the process working directory. */
export function resolveAuditOutputDirectory(
  config: ResolvedConfig,
  outputDir?: string,
): string {
  const configured = outputDir ?? config.outputDir;
  return isAbsolute(configured) ? resolve(configured) : resolve(config.configDir, configured);
}

function findingLogicalId(finding: Finding): string {
  return finding.id || finding.fingerprint.slice(0, 16) || finding.ruleId || "unknown";
}

function sanitizeFlowSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

export function createFlowEvidenceSink(
  writer: ArtifactWriter,
  projectName: string,
): FlowEvidenceSink {
  return {
    writeFlowTrace: async ({ flowId, profile, viewportName, data }) => {
      const bundlePath = writer.relativePath(
        "evidence",
        sanitizeFlowSegment(projectName),
        "flows",
        sanitizeFlowSegment(flowId),
        sanitizeFlowSegment(profile),
        sanitizeFlowSegment(viewportName),
        "flow-trace.json",
      );
      await writer.writeJson(bundlePath, data);
      return bundlePath;
    },
    writeStepScreenshot: async ({ flowId, profile, viewportName, stepIndex, action, data }) => {
      const bundlePath = writer.relativePath(
        "evidence",
        sanitizeFlowSegment(projectName),
        "flows",
        sanitizeFlowSegment(flowId),
        sanitizeFlowSegment(profile),
        sanitizeFlowSegment(viewportName),
        "steps",
        `${String(stepIndex + 1).padStart(3, "0")}-${sanitizeFlowSegment(action)}`,
        "page.png",
      );
      await writer.writeBuffer(bundlePath, data);
      return bundlePath;
    },
    writeCheckpointScreenshot: async ({ flowId, checkpointId, profile, viewportName, data }) => {
      const bundlePath = writer.relativePath(
        "evidence",
        sanitizeFlowSegment(projectName),
        "flows",
        sanitizeFlowSegment(flowId),
        sanitizeFlowSegment(profile),
        sanitizeFlowSegment(viewportName),
        "checkpoints",
        sanitizeFlowSegment(checkpointId),
        "page.png",
      );
      await writer.writeBuffer(bundlePath, data);
      return bundlePath;
    },
  };
}

/**
 * Adapt an artifact writer to the browser's immediate evidence persistence API.
 * Filenames use finding identities only and never include target selectors.
 */
export function createArtifactEvidenceSink(writer: ArtifactWriter): EvidenceSink {
  return {
    writeRunScreenshot: ({ run, data }) =>
      writer.writeEvidence({
        projectName: run.projectName,
        routeId: run.routeId ?? "route",
        profile: run.profile,
        viewportName: run.viewport?.name ?? "default",
        filename: "page.png",
        data,
      }),
    writeFindingScreenshot: ({ run, finding, targetIndex, data }) =>
      writer.writeEvidence({
        projectName: run.projectName,
        routeId: run.routeId ?? "route",
        profile: run.profile,
        viewportName: run.viewport?.name ?? "default",
        filename: `finding-${findingLogicalId(finding)}-${targetIndex}.png`,
        data,
      }),
  };
}

function buildManifest(
  config: ResolvedConfig,
  result: AuditExecutionResult,
  writer: ArtifactWriter,
  reportGenerated: boolean,
  sarifEntry?: SarifReportManifestEntry,
  junitEntry?: JunitReportManifestEntry,
  markdownEntry?: MarkdownReportManifestEntry,
): AuditManifest {
  const manifest: AuditManifest = {
    schemaVersion: "1",
    auditId: writer.auditId,
    createdAt: writer.createdAt,
    status: result.status,
    productVersion: productMetadata.version,
    ...(config.configPath ? { configPath: basename(config.configPath) } : {}),
    projectRoot: ".",
    resultsPath: "results.json",
    ...(reportGenerated ? { reportPath: "report/index.html" } : {}),
    ...(writer.screenshotCount > 0 ? { evidenceDirectory: "evidence" } : {}),
    projects: result.plan.projects.map((project) => ({
      name: project.name,
      platform: project.platform,
      framework: project.framework,
    })),
    artifactCounts: {
      screenshots: writer.screenshotCount,
      findings: result.findings.length,
      runs: result.runs.length,
    },
  };

  const reports = buildReportManifestEntry(
    reportGenerated,
    reportGenerated ? "report/index.html" : undefined,
    sarifEntry,
    junitEntry,
    markdownEntry,
  );
  if (reports) {
    manifest.reports = reports;
  }

  if (result.policyEvaluation) {
    manifest.policy = {
      status: result.policyEvaluation.status,
      policyEnabled: result.policyEvaluation.policyEnabled,
      totalBreaches: result.policyEvaluation.summary.totalBreaches,
    };
  }

  return manifest;
}

function relativeArtifactReferences(
  writer: ArtifactWriter,
  reportGenerated: boolean,
  sarifBundlePath?: string,
  junitBundlePath?: string,
  markdownBundlePath?: string,
): NonNullable<AuditExecutionResult["artifacts"]> {
  return {
    outputDirectory: ".",
    manifestPath: "manifest.json",
    resultsPath: "results.json",
    latestPath: "../../latest.json",
    ...(writer.screenshotCount > 0 ? { evidenceDirectory: "evidence" } : {}),
    ...(reportGenerated ? { reportPath: "report/index.html" } : {}),
    ...(sarifBundlePath ? { sarifPath: sarifBundlePath } : {}),
    ...(junitBundlePath ? { junitPath: junitBundlePath } : {}),
    ...(markdownBundlePath ? { markdownPath: markdownBundlePath } : {}),
  };
}

function removeUndefinedProperties(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) removeUndefinedProperties(entry);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) {
      delete (value as Record<string, unknown>)[key];
    } else {
      removeUndefinedProperties(entry);
    }
  }
}

/**
 * Build a `"failed"` result for global operational failures (unknown
 * `--project` selection, ...) that happen before any run could be attempted.
 */
function buildGlobalFailure(
  plan: AuditPlan,
  startedAt: string,
  environment: AuditExecutionResult["environment"],
  diagnostic: Diagnostic,
): AuditExecutionResult {
  return {
    schemaVersion: "1",
    status: "failed",
    summary: {
      status: "failed",
      startedAt,
      durationMs: Math.max(0, Date.now() - new Date(startedAt).getTime()),
      plannedRuns: 0,
      completedRuns: 0,
      skippedRuns: 0,
      failedRuns: 0,
      findingCount: 0,
      findingsBySeverity: emptySeverityCounts(),
    },
    plan,
    runs: [],
    findings: [],
    diagnostics: [...plan.diagnostics, diagnostic],
    limitations: [...LIMITATIONS],
    environment,
  };
}

/**
 * Execute a full audit for a resolved configuration: build the plan, select
 * which planned runs are actually executable in this phase, run web audits
 * through `@a11yst/browser`, and aggregate everything into a single
 * serialisable `AuditExecutionResult`.
 *
 * Never throws for per-run failures (navigation errors, dev server issues,
 * a missing browser, ...) — those are captured as `"failed"` runs and
 * reflected in `summary.status`. It only returns early with a `"failed"`
 * result (no runs attempted) for a global configuration/selection error,
 * e.g. an unknown `--project` name.
 */
export async function executeAudit(
  config: ResolvedConfig,
  options: ExecuteAuditOptions = {},
): Promise<AuditExecutionResult> {
  const startedAt = new Date().toISOString();
  const progress = options.progress;
  const preparedConfig = await prepareAuditConfig(config, progress);
  const plan = createAuditPlan(preparedConfig);
  const environment = buildEnvironment(options.headed);
  const writeArtifacts = options.writeArtifacts ?? true;
  let writer: ArtifactWriter | undefined;

  if (writeArtifacts) {
    try {
      writer = createArtifactWriter({
        outputDir: resolveAuditOutputDirectory(config, options.outputDir),
        auditId: options.artifactAuditId,
        now: options.artifactNow,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create audit artifact bundle: ${message}`, { cause: error });
    }
  }

  let result: AuditExecutionResult | undefined;
  let selection: ReturnType<typeof selectRuns> | undefined;
  try {
    selection = selectRuns(plan, {
      projectNames: options.projectNames,
      profileNames: options.profileNames,
      flowNames: options.flowNames,
      routesOnly: options.routesOnly,
      flowsOnly: options.flowsOnly,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error instanceof UnknownProjectError
        ? "UNKNOWN_PROJECT"
        : error instanceof UnknownProfileError
          ? "UNKNOWN_PROFILE"
          : error instanceof UnknownFlowError
            ? "UNKNOWN_FLOW"
            : "AUDIT_SELECTION_FAILED";
    result = buildGlobalFailure(plan, startedAt, environment, {
      code,
      severity: "error",
      message,
    });
  }

  if (selection) {
    const { executable, skipped } = selection;
    const skippedResults = skipped.map(skippedRunResult);
    const completedResults: AuditRunResult[] = [];
    const runDiagnostics: Diagnostic[] = [];
    const flowExecutions: FlowTrace[] = [];
    const totalExecutableRuns = executable.length;
    let completedExecutableRuns = 0;
    const screenshots = writeArtifacts
      ? (options.screenshots ?? config.evidence?.screenshots ?? true)
      : false;
    const fullPage =
      options.fullPageScreenshots ?? config.evidence?.fullPage ?? false;

    for (const [projectName, runsForProject] of groupRunsByProject(executable)) {
      const project = plan.projects.find((candidate) => candidate.name === projectName);
      if (!project || project.platform !== "web") {
        continue;
      }

      const routeRuns = runsForProject.filter((run) => isRouteRun(run));
      const flowRuns = runsForProject.filter((run) => isFlowCheckpointRun(run));

      const sharedEvidence = {
        screenshots,
        fullPage,
        ...(screenshots && writer
          ? { sink: createArtifactEvidenceSink(writer) }
          : {}),
        ...(writer
          ? {
              writeStructuredEvidence: async ({
                run,
                filename,
                data,
              }: {
                run: PlannedRun;
                filename: string;
                data: unknown;
              }) =>
                writer!.writeEvidence({
                  projectName: run.projectName,
                  routeId: run.routeId ?? run.flowId ?? "route",
                  profile: run.profile,
                  viewportName: run.viewport?.name ?? "default",
                  filename,
                  data: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8"),
                }),
              ...(flowRuns.length > 0
                ? { writeFlowEvidence: createFlowEvidenceSink(writer, project.name) }
                : {}),
            }
          : {}),
      };

      if (routeRuns.length > 0) {
        const batch = await runWebAudit({
          project,
          runs: routeRuns,
          configDir: config.configDir,
          evidence: sharedEvidence,
          options: {
            headed: options.headed,
            navigationTimeoutMs: options.navigationTimeoutMs,
            noStartServer: options.noStartServer,
            signal: options.signal,
            progress,
            runProgressOffset: completedExecutableRuns,
            runProgressTotal: totalExecutableRuns,
          },
        });
        completedResults.push(...batch.runs);
        runDiagnostics.push(...batch.diagnostics);
        completedExecutableRuns += routeRuns.length;
      }

      if (flowRuns.length > 0) {
        const batch = await runFlowAudit({
          project,
          runs: flowRuns,
          configDir: config.configDir,
          evidence: sharedEvidence,
          options: {
            headed: options.headed,
            navigationTimeoutMs: options.navigationTimeoutMs,
            stepTimeoutMs: options.stepTimeoutMs,
            noStartServer: options.noStartServer,
            signal: options.signal,
            progress,
            runProgressOffset: completedExecutableRuns,
            runProgressTotal: totalExecutableRuns,
          },
        });
        completedResults.push(...batch.runs);
        runDiagnostics.push(...batch.diagnostics);
        flowExecutions.push(...batch.flowExecutions);
        completedExecutableRuns += flowRuns.length;
      }
    }

    const runs = sortRunResults([...completedResults, ...skippedResults]);
    const findings = sortFindings(runs.flatMap((run) => run.findings));
    const summary = aggregateSummary(runs, startedAt);
    const diagnostics = [...plan.diagnostics, ...runDiagnostics];

    result = {
      schemaVersion: "1",
      status: summary.status,
      summary,
      plan,
      runs,
      findings,
      diagnostics,
      limitations: [...LIMITATIONS],
      profileSummary: buildProfileSummary(runs),
      flowSummary: buildFlowSummary(plan, runs),
      ...(flowExecutions.length > 0 ? { flowExecutions } : {}),
      environment,
    };
  }

  if (!result) {
    throw new Error("Audit execution did not produce a result.");
  }

  result = await applySourceAnalysis(config, result, progress);

  const baselineApplied = await applyBaselineComparison(config, result, {
    noBaseline: options.noBaseline,
    baselinePath: options.baselinePath,
    explicitBaselineRequired: options.explicitBaselineRequired,
  });
  result = baselineApplied.result;

  const resolvedPolicy = options.ciPolicy ?? config.ci;
  result = {
    ...result,
    policyEvaluation: applyPolicyEvaluation(result, resolvedPolicy, baselineApplied),
  };

  if (!writer) {
    return result;
  }

  result.auditId = writer.auditId;
  let reportGenerated = false;
  let sarifBundlePath: string | undefined;
  let sarifManifestEntry: SarifReportManifestEntry | undefined;
  let sarifExternalPath: string | undefined;
  let junitBundlePath: string | undefined;
  let junitManifestEntry: JunitReportManifestEntry | undefined;
  let junitExternalPath: string | undefined;
  let markdownBundlePath: string | undefined;
  let markdownManifestEntry: MarkdownReportManifestEntry | undefined;
  let markdownExternalPath: string | undefined;

  const sarifEnabled = options.sarif?.enabled ?? false;
  const shouldGenerateSarif =
    sarifEnabled && shouldGenerateSarifForAuditResult(result);

  const junitEnabled = options.junit?.enabled ?? false;
  const shouldGenerateJunit =
    junitEnabled && shouldGenerateJunitForAuditResult(result);

  const markdownEnabled = options.markdown?.enabled ?? true;
  const shouldGenerateMarkdown =
    markdownEnabled && shouldGenerateMarkdownForAuditResult(result);

  const willGenerateReports =
    (options.html ?? true) ||
    shouldGenerateSarif ||
    shouldGenerateJunit ||
    shouldGenerateMarkdown;

  if (willGenerateReports) {
    progress?.start("Generating reports…");
  }

  if (options.html ?? true) {
    result.artifacts = relativeArtifactReferences(writer, true);
    try {
      await generateHtmlReport({
        auditResult: result,
        outputDirectory: writer.runDirectory,
        auditId: writer.auditId,
      });
      reportGenerated = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.diagnostics.push({
        code: "REPORT_GENERATION_FAILED",
        severity: "error",
        message: `Could not generate the HTML report: ${message}`,
      });
      if (result.status !== "failed") {
        result.status = "completed-with-errors";
        result.summary.status = "completed-with-errors";
      }
    }
  }

  if (shouldGenerateSarif) {
    try {
      const externalPath = options.sarifExternalOutputPath
        ?? (options.sarif?.outputPath
          ? resolve(config.configDir, options.sarif.outputPath)
          : undefined);
      const sarifReport = await generateSarifReport({
        result,
        bundleDirectory: writer.runDirectory,
        ...(externalPath ? { externalOutputPath: externalPath } : {}),
      });
      sarifBundlePath = sarifReport.bundlePath;
      sarifManifestEntry = sarifReport.manifestEntry;
      sarifExternalPath = sarifReport.externalPath;
      result.reports = mergeReportReferences(
        result.reports,
        buildSarifReportReference(sarifReport.resultReference),
      );
    } catch (error) {
      await writer.cleanupPartial().catch(() => {
        // Keep the original SARIF failure as the operational error.
      });
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate SARIF report: ${message}`, { cause: error });
    }
  }

  if (shouldGenerateJunit) {
    try {
      const externalPath = options.junitExternalOutputPath
        ?? (options.junit?.outputPath
          ? resolve(config.configDir, options.junit.outputPath)
          : undefined);
      const junitReport = await generateJunitReport({
        result,
        bundleDirectory: writer.runDirectory,
        ...(externalPath ? { externalOutputPath: externalPath } : {}),
        policy: resolvedPolicy,
      });
      junitBundlePath = junitReport.bundlePath;
      junitManifestEntry = junitReport.manifestEntry;
      junitExternalPath = junitReport.externalPath;
      result.reports = mergeReportReferences(
        result.reports,
        buildJunitReportReference(junitReport.resultReference),
      );
    } catch (error) {
      await writer.cleanupPartial().catch(() => {
        // Keep the original JUnit failure as the operational error.
      });
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate JUnit report: ${message}`, { cause: error });
    }
  }

  if (shouldGenerateMarkdown) {
    try {
      const externalPath = options.markdownExternalOutputPath
        ?? (options.markdown?.outputPath
          ? resolve(config.configDir, options.markdown.outputPath)
          : undefined);
      const markdownReport = await generateMarkdownReportArtifact({
        result,
        bundleDirectory: writer.runDirectory,
        ...(externalPath ? { externalOutputPath: externalPath } : {}),
        policy: resolvedPolicy,
        artifactReportPaths: {
          ...(reportGenerated ? { html: "report/index.html" } : {}),
          ...(sarifBundlePath ? { sarif: sarifBundlePath } : {}),
          ...(junitBundlePath ? { junit: junitBundlePath } : {}),
        },
      });
      markdownBundlePath = markdownReport.bundlePath;
      markdownManifestEntry = markdownReport.manifestEntry;
      markdownExternalPath = markdownReport.externalPath;
      result.reports = mergeReportReferences(
        result.reports,
        buildMarkdownReportReference(markdownReport.resultReference),
      );
    } catch (error) {
      await writer.cleanupPartial().catch(() => {});
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate Markdown report: ${message}`, { cause: error });
    }
  }

  if (willGenerateReports) {
    const reportLabels: string[] = [];
    if (reportGenerated) {
      reportLabels.push("HTML");
    }
    if (markdownBundlePath) {
      reportLabels.push("Markdown");
    }
    if (sarifBundlePath) {
      reportLabels.push("SARIF");
    }
    if (junitBundlePath) {
      reportLabels.push("JUnit");
    }
    reportLabels.push("JSON");
    progress?.succeed(reportLabels.join(" · "));
  }

  result.artifacts = relativeArtifactReferences(
    writer,
    reportGenerated,
    sarifBundlePath,
    junitBundlePath,
    markdownBundlePath,
  );
  const sarifExternalPathForOutput = sarifExternalPath;
  const junitExternalPathForOutput = junitExternalPath;
  const markdownExternalPathForOutput = markdownExternalPath;
  const persistedResult = structuredClone(result);
  removeUndefinedProperties(persistedResult);
  const manifest = buildManifest(
    config,
    persistedResult,
    writer,
    reportGenerated,
    sarifManifestEntry,
    junitManifestEntry,
    markdownManifestEntry,
  );

  try {
    const artifactReferences = await writer.finalize({
      result: persistedResult,
      manifest,
      baselineComparison: baselineApplied.artifact,
    });
    result.artifacts = artifactReferences;
    if (sarifExternalPathForOutput) {
      (result as AuditExecutionResult & { sarifExternalPath?: string }).sarifExternalPath =
        sarifExternalPathForOutput;
    }
    if (junitExternalPathForOutput) {
      (result as AuditExecutionResult & { junitExternalPath?: string }).junitExternalPath =
        junitExternalPathForOutput;
    }
    if (markdownExternalPathForOutput) {
      (result as AuditExecutionResult & { markdownExternalPath?: string }).markdownExternalPath =
        markdownExternalPathForOutput;
    }
    return result;
  } catch (error) {
    await writer.cleanupPartial().catch(() => {
      // Keep the original persistence failure as the operational error.
    });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to finalize audit artifact bundle: ${message}`, { cause: error });
  }
}
