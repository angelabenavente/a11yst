import { readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { emitReportArtifact } from "@a11yst/core";
import {
  findConfigPath,
  loadConfig,
  DEFAULT_OUTPUT_DIR,
} from "@a11yst/config";
import { readAuditResult } from "@a11yst/reporters";
import type { AuditExecutionResult, ResolvedCiPolicyConfig } from "@a11yst/types";

export type ReportFormat = "html" | "sarif" | "junit" | "markdown" | "github-annotations";

export interface RunReportOptions {
  cwd: string;
  resultsPath?: string;
  output?: string;
  format?: ReportFormat;
}

export interface HtmlReportResult {
  format: "html";
  status: "generated";
  resultsPath: string;
  reportPath: string;
  auditId?: string;
}

export interface SarifReportResult {
  format: "sarif";
  status: "generated";
  resultsPath: string;
  sarifPath: string;
  auditId?: string;
  summary: {
    rules: number;
    results: number;
    locatedResults: number;
    unlocatedResults: number;
  };
}

export interface JunitReportResult {
  format: "junit";
  status: "generated";
  resultsPath: string;
  junitPath: string;
  auditId?: string;
  summary: {
    tests: number;
    failures: number;
    errors: number;
    skipped: number;
    timeSeconds: number;
  };
}

export interface MarkdownReportResult {
  format: "markdown";
  status: "generated";
  resultsPath: string;
  markdownPath: string;
  auditId?: string;
  summary: {
    findings: number;
    policyBreaches: number;
    truncatedFindings: number;
  };
}

export interface GitHubAnnotationsReportResult {
  format: "github-annotations";
  status: "generated";
  resultsPath: string;
  githubAnnotationsPath: string;
  auditId?: string;
  summary: {
    annotations: number;
    errors: number;
    warnings: number;
    notices: number;
    truncated: number;
  };
}

export type ReportResult =
  | HtmlReportResult
  | SarifReportResult
  | JunitReportResult
  | MarkdownReportResult
  | GitHubAnnotationsReportResult;

interface LatestDescriptor {
  auditId?: string;
  resultsPath: string;
}

function latestError(message: string): Error {
  return new Error(`${message} Run \`a11yst audit\` to create a new audit result.`);
}

function parseLatestDescriptor(contents: string, latestPath: string): LatestDescriptor {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw latestError(`Invalid latest audit descriptor at "${latestPath}": ${message}`);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw latestError(`Invalid latest audit descriptor at "${latestPath}": expected an object.`);
  }

  const descriptor = value as Record<string, unknown>;
  if (descriptor.schemaVersion !== "1") {
    throw latestError(
      `Incompatible latest audit descriptor at "${latestPath}": expected schemaVersion "1".`,
    );
  }
  if (typeof descriptor.resultsPath !== "string" || descriptor.resultsPath.length === 0) {
    throw latestError(
      `Invalid latest audit descriptor at "${latestPath}": resultsPath must be a non-empty string.`,
    );
  }
  if (descriptor.auditId !== undefined && typeof descriptor.auditId !== "string") {
    throw latestError(
      `Invalid latest audit descriptor at "${latestPath}": auditId must be a string.`,
    );
  }

  return {
    resultsPath: descriptor.resultsPath,
    ...(typeof descriptor.auditId === "string" ? { auditId: descriptor.auditId } : {}),
  };
}

function resolveLatestResultsPath(outputRoot: string, descriptor: LatestDescriptor): string {
  const candidate = descriptor.resultsPath;
  const segments = candidate.split(/[\\/]/);
  if (
    isAbsolute(candidate) ||
    segments.includes("..") ||
    segments.includes("") ||
    segments.includes(".")
  ) {
    throw latestError(
      `Invalid latest audit descriptor: resultsPath "${candidate}" must be a relative path without traversal.`,
    );
  }

  const resolvedPath = resolve(outputRoot, ...segments);
  const relativePath = relative(outputRoot, resolvedPath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw latestError(
      `Invalid latest audit descriptor: resultsPath "${candidate}" resolves outside the audit output directory.`,
    );
  }
  return resolvedPath;
}

async function resolveOutputRoot(cwd: string): Promise<string> {
  if (!findConfigPath(cwd)) {
    return resolve(cwd, DEFAULT_OUTPUT_DIR);
  }
  const config = await loadConfig({ cwd });
  return resolve(config.configDir, config.outputDir);
}

async function resolveReportPolicy(cwd: string): Promise<ResolvedCiPolicyConfig | undefined> {
  if (!findConfigPath(cwd)) {
    return undefined;
  }
  return (await loadConfig({ cwd })).ci;
}

function artifactReportPaths(result: AuditExecutionResult): {
  sarif?: string;
  junit?: string;
} | undefined {
  const paths = {
    ...(result.reports?.sarif?.path ? { sarif: result.reports.sarif.path } : {}),
    ...(result.reports?.junit?.path ? { junit: result.reports.junit.path } : {}),
  };
  return Object.keys(paths).length > 0 ? paths : undefined;
}

async function resolveLatest(cwd: string): Promise<{
  resultsPath: string;
  auditId?: string;
}> {
  const outputRoot = await resolveOutputRoot(cwd);
  const latestPath = resolve(outputRoot, "latest.json");
  let contents: string;
  try {
    contents = await readFile(latestPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw latestError(`Unable to read latest audit descriptor at "${latestPath}": ${message}`);
  }

  const descriptor = parseLatestDescriptor(contents, latestPath);
  return {
    resultsPath: resolveLatestResultsPath(outputRoot, descriptor),
    ...(descriptor.auditId ? { auditId: descriptor.auditId } : {}),
  };
}

function resolveSarifOutputPath(cwd: string, output: string | undefined, resultsPath: string): string {
  if (output) {
    return resolve(cwd, output);
  }
  return resolve(dirname(resultsPath), "a11yst.sarif");
}

function resolveJunitOutputPath(cwd: string, output: string | undefined, resultsPath: string): string {
  if (output) {
    return resolve(cwd, output);
  }
  return resolve(dirname(resultsPath), "a11yst.junit.xml");
}

function resolveMarkdownOutputPath(cwd: string, output: string | undefined, resultsPath: string): string {
  if (output) {
    return resolve(cwd, output);
  }
  return resolve(dirname(resultsPath), "a11yst.md");
}

function resolveGitHubAnnotationsOutputPath(
  cwd: string,
  output: string | undefined,
  resultsPath: string,
): string {
  if (output) {
    return resolve(cwd, output);
  }
  return resolve(dirname(resultsPath), "github-annotations.txt");
}

export async function runReport(options: RunReportOptions): Promise<ReportResult> {
  const cwd = resolve(options.cwd);
  const format = options.format ?? "html";
  const latest = options.resultsPath ? undefined : await resolveLatest(cwd);
  const resultsPath = options.resultsPath
    ? resolve(cwd, options.resultsPath)
    : latest!.resultsPath;

  let auditResult;
  try {
    auditResult = await readAuditResult(resultsPath);
  } catch (error) {
    if (!latest) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw latestError(`Unable to load the latest audit result: ${message}`);
  }

  if (format === "sarif") {
    const sarifPath = resolveSarifOutputPath(cwd, options.output, resultsPath);
    const generation = await emitReportArtifact({
      format: "sarif",
      result: auditResult,
      bundleDirectory: dirname(sarifPath),
      bundleRelativePath: basename(sarifPath),
    });

    return {
      format: "sarif",
      status: "generated",
      resultsPath,
      sarifPath,
      ...(auditResult.auditId ?? latest?.auditId
        ? { auditId: auditResult.auditId ?? latest?.auditId }
        : {}),
      summary: generation.resultReference.summary,
    };
  }

  if (format === "junit") {
    const junitPath = resolveJunitOutputPath(cwd, options.output, resultsPath);
    const policy = await resolveReportPolicy(cwd);
    const generation = await emitReportArtifact({
      format: "junit",
      result: auditResult,
      bundleDirectory: dirname(junitPath),
      bundleRelativePath: basename(junitPath),
      ...(policy ? { policy } : {}),
    });

    return {
      format: "junit",
      status: "generated",
      resultsPath,
      junitPath,
      ...(auditResult.auditId ?? latest?.auditId
        ? { auditId: auditResult.auditId ?? latest?.auditId }
        : {}),
      summary: generation.resultReference.summary,
    };
  }

  if (format === "markdown") {
    const markdownPath = resolveMarkdownOutputPath(cwd, options.output, resultsPath);
    const policy = await resolveReportPolicy(cwd);
    const paths = artifactReportPaths(auditResult);
    const generation = await emitReportArtifact({
      format: "markdown",
      result: auditResult,
      bundleDirectory: dirname(markdownPath),
      bundleRelativePath: basename(markdownPath),
      ...(policy ? { policy } : {}),
      ...(paths ? { artifactReportPaths: paths } : {}),
    });

    return {
      format: "markdown",
      status: "generated",
      resultsPath,
      markdownPath,
      ...(auditResult.auditId ?? latest?.auditId
        ? { auditId: auditResult.auditId ?? latest?.auditId }
        : {}),
      summary: generation.resultReference.summary,
    };
  }

  if (format === "github-annotations") {
    const githubAnnotationsPath = resolveGitHubAnnotationsOutputPath(
      cwd,
      options.output,
      resultsPath,
    );
    const policy = await resolveReportPolicy(cwd);
    const generation = await emitReportArtifact({
      format: "github-annotations",
      result: auditResult,
      bundleDirectory: dirname(githubAnnotationsPath),
      bundleRelativePath: basename(githubAnnotationsPath),
      ...(policy ? { policy } : {}),
    });

    return {
      format: "github-annotations",
      status: "generated",
      resultsPath,
      githubAnnotationsPath,
      ...(auditResult.auditId ?? latest?.auditId
        ? { auditId: auditResult.auditId ?? latest?.auditId }
        : {}),
      summary: generation.resultReference.summary,
    };
  }

  const outputDirectory = options.output
    ? resolve(cwd, options.output)
    : dirname(resultsPath);
  const generated = await emitReportArtifact({
    format: "html",
    result: auditResult,
    bundleDirectory: outputDirectory,
    auditId: auditResult.auditId ?? latest?.auditId,
  });

  return {
    format: "html",
    status: "generated",
    resultsPath,
    reportPath: resolve(generated.bundlePath),
    ...(auditResult.auditId ?? latest?.auditId
      ? { auditId: auditResult.auditId ?? latest?.auditId }
      : {}),
  };
}

export function formatReportHuman(result: ReportResult): string {
  if (result.format === "sarif") {
    const lines = ["SARIF report generated", ""];
    if (result.auditId) {
      lines.push(`Audit ID: ${result.auditId}`);
    }
    lines.push(`JSON report: ${result.resultsPath}`);
    lines.push(`SARIF report: ${result.sarifPath}`);
    return lines.join("\n");
  }

  if (result.format === "junit") {
    const lines = ["JUnit report generated", ""];
    if (result.auditId) {
      lines.push(`Audit ID: ${result.auditId}`);
    }
    lines.push(`JSON report: ${result.resultsPath}`);
    lines.push(`JUnit report: ${result.junitPath}`);
    return lines.join("\n");
  }

  if (result.format === "markdown") {
    const lines = ["Markdown report generated", ""];
    if (result.auditId) {
      lines.push(`Audit ID: ${result.auditId}`);
    }
    lines.push(`JSON report: ${result.resultsPath}`);
    lines.push(`Markdown report: ${result.markdownPath}`);
    return lines.join("\n");
  }

  if (result.format === "github-annotations") {
    const lines = ["GitHub annotations generated", ""];
    if (result.auditId) {
      lines.push(`Audit ID: ${result.auditId}`);
    }
    lines.push(`JSON report: ${result.resultsPath}`);
    lines.push(`GitHub annotations: ${result.githubAnnotationsPath}`);
    return lines.join("\n");
  }

  const lines = ["HTML report generated", ""];
  if (result.auditId) {
    lines.push(`Audit ID: ${result.auditId}`);
  }
  lines.push(`JSON report: ${result.resultsPath}`);
  lines.push(`HTML report: ${result.reportPath}`);
  return lines.join("\n");
}

export function formatReportJson(result: ReportResult): ReportResult {
  return result;
}
