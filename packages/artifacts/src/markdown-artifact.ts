import { randomBytes } from "node:crypto";
import { appendFile, lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const WINDOWS_ABSOLUTE_PATH = /^[a-z]:[\\/]/i;

function assertWithin(root: string, candidate: string): void {
  const fromRoot = relative(root, candidate);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`Resolved path escapes artifact directory: ${candidate}`);
  }
}

function validateBundlePath(path: string): string {
  if (!path || isAbsolute(path) || WINDOWS_ABSOLUTE_PATH.test(path) || path.startsWith("\\\\")) {
    throw new Error(`Bundle path must be a non-empty relative path: ${path}`);
  }
  if (path.includes("\0") || path.includes("\\")) {
    throw new Error(`Bundle path contains unsafe characters: ${path}`);
  }
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Bundle path contains traversal or empty segments: ${path}`);
  }
  return segments.join("/");
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

async function atomicWriteBuffer(root: string, targetPath: string, data: Buffer): Promise<void> {
  assertWithin(root, targetPath);
  const temp = resolve(
    targetPath,
    `../.${targetPath.split(sep).at(-1)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  assertWithin(root, temp);

  try {
    await writeFile(temp, data, { flag: "wx", mode: 0o600 });
    await rename(temp, targetPath);
  } finally {
    await rm(temp, { force: true });
  }
}

async function writeExternalTextArtifact(
  targetPath: string,
  serialized: string,
  label: string,
): Promise<string> {
  const resolved = resolve(targetPath);
  const parent = resolve(resolved, "..");
  await mkdir(parent, { recursive: true });

  try {
    const parentStatus = await lstat(parent);
    if (parentStatus.isSymbolicLink()) {
      throw new Error(`Refusing to write ${label} through a symbolic link parent: ${parent}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    const targetStatus = await lstat(resolved);
    if (targetStatus.isSymbolicLink()) {
      throw new Error(`Refusing to overwrite a symbolic link ${label} target: ${resolved}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const data = Buffer.from(serialized, "utf8");
  const temp = resolve(
    parent,
    `.${resolved.split(sep).at(-1)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    await writeFile(temp, data, { flag: "wx", mode: 0o600 });
    await rename(temp, resolved);
  } finally {
    await rm(temp, { force: true });
  }
  return resolved;
}

function assertTrailingNewline(serialized: string, label: string): void {
  if (!serialized.endsWith("\n")) {
    throw new Error(`${label} payload must end with a trailing newline.`);
  }
}

export interface WriteMarkdownArtifactOptions {
  bundleDirectory: string;
  relativePath: string;
  serializedMarkdown: string;
}

export interface WriteExternalMarkdownArtifactOptions {
  targetPath: string;
  serializedMarkdown: string;
}

export async function writeMarkdownArtifact(
  options: WriteMarkdownArtifactOptions,
): Promise<string> {
  const bundlePath = validateBundlePath(options.relativePath);
  assertTrailingNewline(options.serializedMarkdown, "Markdown");
  const target = await ensureSafeParent(options.bundleDirectory, bundlePath);
  await atomicWriteBuffer(
    options.bundleDirectory,
    target,
    Buffer.from(options.serializedMarkdown, "utf8"),
  );
  return bundlePath;
}

export async function writeExternalMarkdownArtifact(
  options: WriteExternalMarkdownArtifactOptions,
): Promise<string> {
  assertTrailingNewline(options.serializedMarkdown, "Markdown");
  return writeExternalTextArtifact(
    options.targetPath,
    options.serializedMarkdown,
    "Markdown",
  );
}

export interface WriteGitHubAnnotationsArtifactOptions {
  bundleDirectory: string;
  relativePath: string;
  serializedCommands: string;
}

export interface WriteExternalGitHubAnnotationsArtifactOptions {
  targetPath: string;
  serializedCommands: string;
}

export async function writeGitHubAnnotationsArtifact(
  options: WriteGitHubAnnotationsArtifactOptions,
): Promise<string> {
  const bundlePath = validateBundlePath(options.relativePath);
  if (options.serializedCommands.length > 0 && !options.serializedCommands.endsWith("\n")) {
    throw new Error("GitHub annotations payload must end with a trailing newline when non-empty.");
  }
  const target = await ensureSafeParent(options.bundleDirectory, bundlePath);
  await atomicWriteBuffer(
    options.bundleDirectory,
    target,
    Buffer.from(options.serializedCommands, "utf8"),
  );
  return bundlePath;
}

export async function writeExternalGitHubAnnotationsArtifact(
  options: WriteExternalGitHubAnnotationsArtifactOptions,
): Promise<string> {
  if (options.serializedCommands.length > 0 && !options.serializedCommands.endsWith("\n")) {
    throw new Error("GitHub annotations payload must end with a trailing newline when non-empty.");
  }
  return writeExternalTextArtifact(
    options.targetPath,
    options.serializedCommands,
    "GitHub annotations",
  );
}

export async function appendGitHubStepSummary(
  targetPath: string,
  markdown: string,
): Promise<void> {
  if (!targetPath.trim()) {
    throw new Error("GITHUB_STEP_SUMMARY path must not be empty.");
  }
  const resolved = resolve(targetPath);
  try {
    const status = await lstat(resolved);
    if (status.isSymbolicLink()) {
      throw new Error("Refusing to append to a symbolic link GITHUB_STEP_SUMMARY target.");
    }
    if (status.isDirectory()) {
      throw new Error("GITHUB_STEP_SUMMARY must point to a file, not a directory.");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const payload = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
  let prefix = "";
  try {
    const status = await lstat(resolved);
    if (status.isFile() && status.size > 0) {
      prefix = "\n";
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await mkdir(resolve(resolved, ".."), { recursive: true });
  }

  await appendFile(resolved, `${prefix}${payload}`, { encoding: "utf8", flag: "a" });
}
