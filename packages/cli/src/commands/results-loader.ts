import { readFile } from "node:fs/promises";
import {
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import {
  findConfigPath,
  loadConfig,
  DEFAULT_OUTPUT_DIR,
} from "@a11yst/config";
import { readAuditResult } from "@a11yst/reporters";
import type { AuditExecutionResult } from "@a11yst/types";

export interface LatestResultsDescriptor {
  resultsPath: string;
  auditId?: string;
}

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

export async function resolveLatestResults(cwd: string): Promise<LatestResultsDescriptor> {
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

export async function loadAuditResults(options: {
  cwd: string;
  resultsPath?: string;
}): Promise<{ result: AuditExecutionResult; resultsPath: string; auditId?: string }> {
  const cwd = resolve(options.cwd);
  const latest = options.resultsPath ? undefined : await resolveLatestResults(cwd);
  const resultsPath = options.resultsPath
    ? resolve(cwd, options.resultsPath)
    : latest!.resultsPath;

  let result: AuditExecutionResult;
  try {
    result = await readAuditResult(resultsPath);
  } catch (error) {
    if (!latest) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw latestError(`Unable to load the latest audit result: ${message}`);
  }

  return {
    result,
    resultsPath,
    ...(result.auditId ?? latest?.auditId ? { auditId: result.auditId ?? latest?.auditId } : {}),
  };
}
