import { randomBytes } from "node:crypto";
import { lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
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

export interface WriteJunitArtifactOptions {
  bundleDirectory: string;
  relativePath: string;
  serializedJunit: string;
}

export interface WriteExternalJunitArtifactOptions {
  targetPath: string;
  serializedJunit: string;
}

export async function writeJunitArtifact(
  options: WriteJunitArtifactOptions,
): Promise<string> {
  const bundlePath = validateBundlePath(options.relativePath);
  const data = Buffer.from(options.serializedJunit, "utf8");
  if (!data.toString("utf8").endsWith("\n")) {
    throw new Error("JUnit payload must end with a trailing newline.");
  }
  const target = await ensureSafeParent(options.bundleDirectory, bundlePath);
  await atomicWriteBuffer(options.bundleDirectory, target, data);
  return bundlePath;
}

export async function writeExternalJunitArtifact(
  options: WriteExternalJunitArtifactOptions,
): Promise<string> {
  const targetPath = resolve(options.targetPath);
  const parent = resolve(targetPath, "..");
  await mkdir(parent, { recursive: true });

  try {
    const parentStatus = await lstat(parent);
    if (parentStatus.isSymbolicLink()) {
      throw new Error(`Refusing to write JUnit through a symbolic link parent: ${parent}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    const targetStatus = await lstat(targetPath);
    if (targetStatus.isSymbolicLink()) {
      throw new Error(`Refusing to overwrite a symbolic link JUnit target: ${targetPath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const data = Buffer.from(options.serializedJunit, "utf8");
  if (!data.toString("utf8").endsWith("\n")) {
    throw new Error("JUnit payload must end with a trailing newline.");
  }

  const temp = resolve(
    parent,
    `.${targetPath.split(sep).at(-1)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    await writeFile(temp, data, { flag: "wx", mode: 0o600 });
    await rename(temp, targetPath);
  } finally {
    await rm(temp, { force: true });
  }
  return targetPath;
}
