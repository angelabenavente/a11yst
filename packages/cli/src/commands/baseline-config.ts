import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "@a11yst/config";
import { resolveBaselinePath } from "@a11yst/baseline";
import type { ResolvedBaselineConfig } from "@a11yst/types";

export interface BaselineContext {
  configDir: string;
  baseline: ResolvedBaselineConfig;
  baselinePath: string;
}

export async function loadBaselineContext(options: {
  cwd: string;
  configPath?: string;
  baselineOverride?: string;
}): Promise<BaselineContext> {
  const config = await loadConfig({
    cwd: options.cwd,
    configPath: options.configPath,
  });
  const relativePath = options.baselineOverride ?? config.baseline.file;
  const baselinePath = resolveBaselinePath(config.configDir, relativePath);
  return {
    configDir: config.configDir,
    baseline: config.baseline,
    baselinePath,
  };
}

export async function baselineFileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function resolveBaselinePathFromCwd(cwd: string, relativeOrAbsolute: string): string {
  if (relativeOrAbsolute.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relativeOrAbsolute)) {
    return resolve(relativeOrAbsolute);
  }
  return resolve(cwd, relativeOrAbsolute);
}
