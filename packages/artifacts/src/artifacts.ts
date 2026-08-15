import { createHash, randomBytes } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  realpathSync,
} from "node:fs";
import {
  lstat,
  mkdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type {
  AuditArtifactReferences,
  AuditExecutionResult,
  AuditManifest,
  BaselineComparisonArtifact,
} from "@a11yst/types";

const DEFAULT_SEGMENT_LENGTH = 80;
const HASH_LENGTH = 8;
const WINDOWS_RESERVED_NAME =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const WINDOWS_ABSOLUTE_PATH = /^[a-z]:[\\/]/i;
const PERCENT_ESCAPE = /%[0-9a-f]{2}/i;

export interface AuditIdOptions {
  now?: Date;
  entropy?: string;
}

export interface SanitizePathSegmentOptions {
  fallback?: string;
  maxLength?: number;
}

export interface ArtifactWriterOptions {
  outputDir: string;
  auditId?: string;
  now?: Date;
}

export interface EvidenceWriteOptions {
  projectName: string;
  routeId: string;
  profile: string;
  viewportName: string;
  filename: string;
  data: Buffer;
}

export interface FinalizeOptions {
  result: AuditExecutionResult;
  manifest: AuditManifest;
  baselineComparison?: BaselineComparisonArtifact;
}

export interface LatestArtifactDescriptor {
  schemaVersion: string;
  auditId: string;
  manifestPath: string;
  resultsPath: string;
  reportPath?: string;
  sarifPath?: string;
  createdAt: string;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, HASH_LENGTH);
}

function replaceUnsafePathCharacters(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 ||
      codePoint === 127 ||
      '<>:"/\\|?*%'.includes(character)
      ? "-"
      : character;
  }).join("");
}

function truncateWithoutSplitting(value: string, maxLength: number): string {
  const truncated = value.slice(0, Math.max(0, maxLength));
  const lastCodeUnit = truncated.charCodeAt(truncated.length - 1);
  return lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff
    ? truncated.slice(0, -1)
    : truncated;
}

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("now must be a valid Date");
  }
}

export function createAuditId(options: AuditIdOptions = {}): string {
  const now = options.now ?? new Date();
  assertValidDate(now);

  const timestamp = now
    .toISOString()
    .replace(/[-:.]/g, "")
    .replace("Z", "Z");
  const suffix =
    options.entropy === undefined
      ? randomBytes(6).toString("hex")
      : shortHash(options.entropy);

  return `${timestamp}-${suffix}`;
}

export function sanitizePathSegment(
  value: string,
  options: SanitizePathSegmentOptions = {},
): string {
  const maxLength = options.maxLength ?? DEFAULT_SEGMENT_LENGTH;
  if (!Number.isInteger(maxLength) || maxLength < HASH_LENGTH + 2) {
    throw new RangeError(`maxLength must be an integer of at least ${HASH_LENGTH + 2}`);
  }

  const original = value;
  let candidate = value.normalize("NFKC").trim();
  let collisionRisk = candidate !== original;

  const replaceRisky = (pattern: RegExp, replacement: string): void => {
    const replaced = candidate.replace(pattern, replacement);
    collisionRisk ||= replaced !== candidate;
    candidate = replaced;
  };

  const unsafeReplaced = replaceUnsafePathCharacters(candidate);
  collisionRisk ||= unsafeReplaced !== candidate;
  candidate = unsafeReplaced;
  replaceRisky(/\s+/g, "-");
  replaceRisky(/^[.-]+|[.-]+$/g, "");
  replaceRisky(/-+/g, "-");
  replaceRisky(/^-+|-+$/g, "");

  if (candidate === "." || candidate === ".." || WINDOWS_RESERVED_NAME.test(candidate)) {
    collisionRisk = true;
    candidate = "";
  }

  if (!candidate) {
    const fallback = replaceUnsafePathCharacters(
      (options.fallback ?? "artifact").normalize("NFKC"),
    )
      .replace(/\s+/g, "-")
      .replace(/^\.+|\.+$/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    candidate =
      fallback && fallback !== "." && fallback !== ".." && !WINDOWS_RESERVED_NAME.test(fallback)
        ? fallback
        : "artifact";
    collisionRisk = true;
  }

  const hashSuffix = `-${shortHash(original)}`;
  if (candidate.length > maxLength) {
    collisionRisk = true;
  }

  if (collisionRisk) {
    const extensionMatch = candidate.match(/(\.[\p{L}\p{N}]{1,10})$/u);
    const matchedExtension = extensionMatch?.[1] ?? "";
    const extension =
      matchedExtension.length + hashSuffix.length < maxLength ? matchedExtension : "";
    const stem = extension ? candidate.slice(0, -extension.length) : candidate;
    const prefixLength = maxLength - hashSuffix.length - extension.length;
    candidate = `${truncateWithoutSplitting(stem, prefixLength).replace(/[.-]+$/g, "")}${hashSuffix}${extension}`;
  }

  return candidate || `artifact-${shortHash(original)}`.slice(0, maxLength);
}

function normalizeJsonValue(
  value: unknown,
  location: string,
  ancestors: Set<object>,
): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot serialize non-finite number at ${location}`);
    }
    return value;
  }
  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    throw new TypeError(`Cannot serialize ${typeof value} at ${location}`);
  }
  if (typeof value !== "object") {
    throw new TypeError(`Cannot serialize value at ${location}`);
  }
  if (ancestors.has(value)) {
    throw new TypeError(`Cannot serialize circular reference at ${location}`);
  }

  ancestors.add(value);
  try {
    if (value instanceof Date) {
      assertValidDate(value);
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((entry, index) =>
        normalizeJsonValue(entry, `${location}[${index}]`, ancestors),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(
        `Cannot serialize unsupported ${value.constructor?.name ?? "object"} at ${location}`,
      );
    }

    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) {
        throw new TypeError(`Cannot serialize undefined at ${location}.${key}`);
      }
      normalized[key] = normalizeJsonValue(
        entry,
        `${location}.${key}`,
        ancestors,
      );
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(normalizeJsonValue(value, "$", new Set()), null, 2)}\n`;
}

function stripUndefinedProperties(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedProperties(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }
  const stripped: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) {
      continue;
    }
    stripped[key] = stripUndefinedProperties(entry);
  }
  return stripped;
}

function validateBundlePath(path: string): string {
  if (!path || isAbsolute(path) || WINDOWS_ABSOLUTE_PATH.test(path) || path.startsWith("\\\\")) {
    throw new Error(`Bundle path must be a non-empty relative path: ${path}`);
  }
  if (path.includes("\0") || path.includes("\\") || PERCENT_ESCAPE.test(path)) {
    throw new Error(`Bundle path contains unsafe characters: ${path}`);
  }

  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Bundle path contains traversal or empty segments: ${path}`);
  }
  for (const segment of segments) {
    if (
      replaceUnsafePathCharacters(segment) !== segment ||
      /[. ]$/.test(segment) ||
      WINDOWS_RESERVED_NAME.test(segment)
    ) {
      throw new Error(`Bundle path is not portable: ${path}`);
    }
  }
  return segments.join("/");
}

function assertWithin(root: string, candidate: string): void {
  const fromRoot = relative(root, candidate);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`Resolved path escapes artifact directory: ${candidate}`);
  }
}

function rejectExistingSymlinks(root: string, relativePath: string): void {
  let current = root;
  for (const segment of relativePath.split("/")) {
    current = resolve(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in artifact paths: ${relativePath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      return;
    }
  }
}

function createSafeDirectory(root: string, relativePath: string): string {
  let current = root;
  for (const segment of relativePath.split("/")) {
    current = resolve(current, segment);
    try {
      const status = lstatSync(current);
      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new Error(`Artifact directory segment is not a directory: ${current}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      mkdirSync(current);
    }
  }
  return current;
}

async function ensureSafeParent(root: string, bundlePath: string): Promise<string> {
  const segments = bundlePath.split("/");
  const filename = segments.pop();
  if (!filename) {
    throw new Error(`Artifact path must include a filename: ${bundlePath}`);
  }

  let current = root;
  for (const segment of segments) {
    current = resolve(current, segment);
    try {
      const status = await lstat(current);
      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new Error(`Artifact path contains an unsafe directory: ${current}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      await mkdir(current);
    }
  }

  const target = resolve(current, filename);
  try {
    if ((await lstat(target)).isSymbolicLink()) {
      throw new Error(`Artifact target cannot be a symbolic link: ${bundlePath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  return target;
}

async function atomicWrite(root: string, bundlePath: string, data: Buffer): Promise<void> {
  const target = await ensureSafeParent(root, bundlePath);
  assertWithin(root, target);
  const temp = resolve(
    target,
    `../.${target.split(sep).at(-1)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  assertWithin(root, temp);

  try {
    await writeFile(temp, data, { flag: "wx", mode: 0o600 });
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true });
  }
}

export class ArtifactWriter {
  readonly auditId: string;
  readonly outputDir: string;
  readonly runDirectory: string;
  readonly createdAt: string;
  #screenshotCount = 0;

  constructor(options: ArtifactWriterOptions) {
    const now = options.now ?? new Date();
    assertValidDate(now);
    this.createdAt = now.toISOString();

    mkdirSync(resolve(options.outputDir), { recursive: true });
    this.outputDir = realpathSync(resolve(options.outputDir));
    createSafeDirectory(this.outputDir, "runs");

    this.auditId = options.auditId ?? createAuditId({ now });
    validateBundlePath(this.auditId);
    this.runDirectory = createSafeDirectory(this.outputDir, `runs/${this.auditId}`);
  }

  get screenshotCount(): number {
    return this.#screenshotCount;
  }

  relativePath(...segments: string[]): string {
    if (segments.length === 0) {
      throw new Error("At least one bundle path segment is required");
    }
    return validateBundlePath(segments.join("/"));
  }

  resolveBundlePath(relativePath: string): string {
    const bundlePath = validateBundlePath(relativePath);
    const resolved = resolve(this.runDirectory, ...bundlePath.split("/"));
    assertWithin(this.runDirectory, resolved);
    rejectExistingSymlinks(this.runDirectory, bundlePath);
    return resolved;
  }

  async writeJson(relativePath: string, value: unknown): Promise<void> {
    await this.writeBuffer(relativePath, Buffer.from(stableStringify(value)));
  }

  async writeBuffer(relativePath: string, data: Buffer): Promise<void> {
    const bundlePath = validateBundlePath(relativePath);
    this.resolveBundlePath(bundlePath);
    await atomicWrite(this.runDirectory, bundlePath, data);
  }

  async writeResults(result: AuditExecutionResult): Promise<void> {
    await this.writeJson("results.json", result);
  }

  async writeManifest(manifest: AuditManifest): Promise<void> {
    await this.writeJson("manifest.json", manifest);
  }

  async writeEvidence(options: EvidenceWriteOptions): Promise<string> {
    const extensionMatch = options.filename.match(/(\.[\p{L}\p{N}]{1,10})$/u);
    const extension = extensionMatch?.[1] ?? "";
    const looksLikeSelector = ["#", ">", "[", "]", "=", "'", '"'].some((character) =>
      options.filename.includes(character),
    );
    const filename = looksLikeSelector
      ? `evidence-${shortHash(options.filename)}${extension}`
      : sanitizePathSegment(options.filename, { maxLength: 120 });
    const bundlePath = this.relativePath(
      "evidence",
      sanitizePathSegment(options.projectName),
      sanitizePathSegment(options.routeId),
      sanitizePathSegment(options.profile),
      sanitizePathSegment(options.viewportName),
      filename,
    );
    await this.writeBuffer(bundlePath, options.data);
    if (/\.(?:png|jpe?g|webp|gif)$/i.test(options.filename)) {
      this.#screenshotCount += 1;
    }
    return bundlePath;
  }

  async writeReportAsset(
    relativePathUnderReport: string,
    data: Buffer | string,
  ): Promise<string> {
    const reportPath = this.relativePath("report", validateBundlePath(relativePathUnderReport));
    await this.writeBuffer(
      reportPath,
      typeof data === "string" ? Buffer.from(data) : data,
    );
    return reportPath;
  }

  async finalize(options: FinalizeOptions): Promise<AuditArtifactReferences> {
    await this.writeResults(options.result);
    await this.writeManifest(options.manifest);

    let baselineComparisonPath: string | undefined;
    if (options.baselineComparison) {
      baselineComparisonPath = "baseline-comparison.json";
      const comparison = stripUndefinedProperties(options.baselineComparison);
      await atomicWrite(
        this.runDirectory,
        baselineComparisonPath,
        Buffer.from(stableStringify(comparison)),
      );
    }

    const latest: LatestArtifactDescriptor = {
      schemaVersion: options.manifest.schemaVersion,
      auditId: this.auditId,
      manifestPath: `runs/${this.auditId}/manifest.json`,
      resultsPath: `runs/${this.auditId}/results.json`,
      ...(options.manifest.reportPath
        ? { reportPath: `runs/${this.auditId}/${validateBundlePath(options.manifest.reportPath)}` }
        : {}),
      ...(options.manifest.reports?.sarif?.path
        ? {
            sarifPath: `runs/${this.auditId}/${validateBundlePath(options.manifest.reports.sarif.path)}`,
          }
        : {}),
      ...(options.manifest.reports?.junit?.path
        ? {
            junitPath: `runs/${this.auditId}/${validateBundlePath(options.manifest.reports.junit.path)}`,
          }
        : {}),
      ...(options.manifest.reports?.markdown?.path
        ? {
            markdownPath: `runs/${this.auditId}/${validateBundlePath(options.manifest.reports.markdown.path)}`,
          }
        : {}),
      ...(options.manifest.reports?.githubAnnotations?.path
        ? {
            githubAnnotationsPath: `runs/${this.auditId}/${validateBundlePath(options.manifest.reports.githubAnnotations.path)}`,
          }
        : {}),
      createdAt: this.createdAt,
    };
    await atomicWrite(this.outputDir, "latest.json", Buffer.from(stableStringify(latest)));

    return {
      outputDirectory: this.runDirectory,
      manifestPath: resolve(this.runDirectory, "manifest.json"),
      resultsPath: resolve(this.runDirectory, "results.json"),
      ...(options.manifest.reportPath
        ? { reportPath: this.resolveBundlePath(options.manifest.reportPath) }
        : {}),
      ...(options.manifest.reports?.sarif?.path
        ? { sarifPath: this.resolveBundlePath(options.manifest.reports.sarif.path) }
        : {}),
      ...(options.manifest.reports?.junit?.path
        ? { junitPath: this.resolveBundlePath(options.manifest.reports.junit.path) }
        : {}),
      ...(options.manifest.reports?.markdown?.path
        ? { markdownPath: this.resolveBundlePath(options.manifest.reports.markdown.path) }
        : {}),
      ...(options.manifest.reports?.githubAnnotations?.path
        ? {
            githubAnnotationsPath: this.resolveBundlePath(
              options.manifest.reports.githubAnnotations.path,
            ),
          }
        : {}),
      ...(options.manifest.evidenceDirectory
        ? { evidenceDirectory: this.resolveBundlePath(options.manifest.evidenceDirectory) }
        : {}),
      ...(baselineComparisonPath
        ? { baselineComparisonPath: resolve(this.runDirectory, baselineComparisonPath) }
        : {}),
      latestPath: resolve(this.outputDir, "latest.json"),
    };
  }

  async cleanupPartial(): Promise<void> {
    const runsDirectory = resolve(this.outputDir, "runs");
    assertWithin(runsDirectory, this.runDirectory);
    try {
      const runsStatus = await lstat(runsDirectory);
      if (runsStatus.isSymbolicLink() || !runsStatus.isDirectory()) {
        throw new Error("Refusing to clean through an unsafe runs directory");
      }
      const status = await lstat(this.runDirectory);
      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new Error("Refusing to clean an unsafe run directory");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }
    await rm(this.runDirectory, { recursive: true });
  }
}

export function createArtifactWriter(options: ArtifactWriterOptions): ArtifactWriter {
  return new ArtifactWriter(options);
}
