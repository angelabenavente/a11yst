import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { BaselineFile } from "@a11yst/types";
import { validateBaselineFile } from "./schema.js";
import { sortEntries } from "./create.js";
import { stableStringify } from "./serialize.js";

export class BaselineReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineReadError";
  }
}

export class BaselineWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineWriteError";
  }
}

export class BaselineConcurrentModificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineConcurrentModificationError";
  }
}

export interface BaselineFileState {
  content: string;
  hash: string;
  mtimeMs: number;
}

export async function readBaselineFileState(filePath: string): Promise<BaselineFileState> {
  try {
    const content = await readFile(filePath, "utf8");
    const fileStat = await stat(filePath);
    return {
      content,
      hash: hashContent(content),
      mtimeMs: fileStat.mtimeMs,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new BaselineReadError(`Baseline file not found: ${filePath}`);
    }
    throw new BaselineReadError(
      `Could not read baseline file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function loadBaselineFile(filePath: string): Promise<BaselineFile> {
  const state = await readBaselineFileState(filePath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(state.content);
  } catch (error) {
    throw new BaselineReadError(
      `Baseline file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return validateBaselineFile(parsed);
}

export interface WriteBaselineOptions {
  expectedHash?: string;
  expectedMtimeMs?: number;
}

export async function writeBaselineFile(
  filePath: string,
  baseline: BaselineFile,
  options: WriteBaselineOptions = {},
): Promise<void> {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true });

  if (options.expectedHash || options.expectedMtimeMs !== undefined) {
    try {
      const current = await readBaselineFileState(filePath);
      if (options.expectedHash && current.hash !== options.expectedHash) {
        throw new BaselineConcurrentModificationError(
          "Baseline file changed since it was loaded. Reload and try again.",
        );
      }
      if (
        options.expectedMtimeMs !== undefined &&
        current.mtimeMs !== options.expectedMtimeMs
      ) {
        throw new BaselineConcurrentModificationError(
          "Baseline file changed since it was loaded. Reload and try again.",
        );
      }
    } catch (error) {
      if (error instanceof BaselineConcurrentModificationError) {
        throw error;
      }
      if ((error as BaselineReadError).name !== "BaselineReadError") {
        throw error;
      }
      // File removed between read and write — treat as concurrent modification when expectations exist.
      if (options.expectedHash) {
        throw new BaselineConcurrentModificationError(
          "Baseline file changed since it was loaded. Reload and try again.",
        );
      }
    }
  }

  const normalized: BaselineFile = {
    ...baseline,
    entries: sortEntries(baseline.entries),
  };
  const content = stableStringify(normalized);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(tempPath, content, "utf8");
    const parsed = validateBaselineFile(JSON.parse(content));
    if (parsed.entries.length !== normalized.entries.length) {
      throw new BaselineWriteError("Temporary baseline validation failed.");
    }
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error instanceof BaselineWriteError || error instanceof BaselineConcurrentModificationError
      ? error
      : new BaselineWriteError(
          `Could not write baseline file: ${error instanceof Error ? error.message : String(error)}`,
        );
  }
}

export function resolveBaselinePath(configDir: string, relativePath: string): string {
  const resolved = resolve(configDir, relativePath);
  if (!resolved.startsWith(resolve(configDir))) {
    throw new BaselineReadError("Baseline path escapes the configuration directory.");
  }
  return resolved;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
