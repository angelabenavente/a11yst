import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { writeExternalJunitArtifact, writeExternalMarkdownArtifact, writeExternalSarifArtifact } from "@a11yst/artifacts";
import {
  createJunitInputFromAuditResult,
  createMarkdownInputFromAuditResult,
  createSarifInputFromAuditResult,
} from "@a11yst/core";
import {
  findConfigPath,
  loadConfig,
  DEFAULT_OUTPUT_DIR,
} from "@a11yst/config";
import {
  generateHtmlReport,
  generateMarkdownReport,
  readAuditResult,
} from "@a11yst/reporters";
import { generateJunit, serializeJunit } from "@a11yst/junit";
import { generateSarif, serializeSarif } from "@a11yst/sarif";

export type ReportFormat = "html" | "sarif" | "junit" | "markdown";

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

export type ReportResult =
  | HtmlReportResult
  | SarifReportResult
  | JunitReportResult
  | MarkdownReportResult;

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
    const input = createSarifInputFromAuditResult(auditResult);
    const generation = generateSarif(input, { includeResolvedSummary: true });
    const serialized = serializeSarif(generation.log);
    const writtenPath = await writeExternalSarifArtifact({
      targetPath: sarifPath,
      serializedSarif: serialized,
    });

    return {
      format: "sarif",
      status: "generated",
      resultsPath,
      sarifPath: writtenPath,
      ...(auditResult.auditId ?? latest?.auditId
        ? { auditId: auditResult.auditId ?? latest?.auditId }
        : {}),
      summary: {
        rules: generation.summary.rules,
        results: generation.summary.results,
        locatedResults: generation.summary.locatedResults,
        unlocatedResults: generation.summary.unlocatedResults,
      },
    };
  }

  if (format === "junit") {
    const junitPath = resolveJunitOutputPath(cwd, options.output, resultsPath);
    const input = createJunitInputFromAuditResult(auditResult);
    const generation = generateJunit(input);
    const serialized = serializeJunit(generation.document);
    const writtenPath = await writeExternalJunitArtifact({
      targetPath: junitPath,
      serializedJunit: serialized,
    });

    return {
      format: "junit",
      status: "generated",
      resultsPath,
      junitPath: writtenPath,
      ...(auditResult.auditId ?? latest?.auditId
        ? { auditId: auditResult.auditId ?? latest?.auditId }
        : {}),
      summary: {
        tests: generation.summary.tests,
        failures: generation.summary.failures,
        errors: generation.summary.errors,
        skipped: generation.summary.skipped,
        timeSeconds: generation.summary.timeSeconds,
      },
    };
  }

  if (format === "markdown") {
    const markdownPath = resolveMarkdownOutputPath(cwd, options.output, resultsPath);
    const input = createMarkdownInputFromAuditResult(auditResult, undefined, auditResult.reports);
    const generation = generateMarkdownReport(input);
    const writtenPath = await writeExternalMarkdownArtifact({
      targetPath: markdownPath,
      serializedMarkdown: generation.markdown,
    });

    return {
      format: "markdown",
      status: "generated",
      resultsPath,
      markdownPath: writtenPath,
      ...(auditResult.auditId ?? latest?.auditId
        ? { auditId: auditResult.auditId ?? latest?.auditId }
        : {}),
      summary: {
        findings: generation.summary.findings,
        policyBreaches: generation.summary.policyBreaches,
        truncatedFindings: generation.summary.truncatedFindings,
      },
    };
  }

  const outputDirectory = options.output
    ? resolve(cwd, options.output)
    : dirname(resultsPath);
  const generated = await generateHtmlReport({
    auditResult,
    outputDirectory,
    auditId: auditResult.auditId ?? latest?.auditId,
  });

  return {
    format: "html",
    status: "generated",
    resultsPath,
    reportPath: resolve(generated.indexPath),
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
