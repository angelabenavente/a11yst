import { createJiti } from "jiti";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { A11ystConfig, ResolvedConfig } from "@a11yst/types";
import { productMetadata } from "@a11yst/types";
import { CONFIG_FILENAMES } from "./defaults.js";
import { ConfigError } from "./errors.js";
import { validateConfig } from "./validate.js";

export interface LoadConfigOptions {
  /** Directory to start searching from. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Explicit config file path. */
  configPath?: string;
}

/**
 * Resolve an absolute path relative to the config directory when needed.
 */
export function resolveProjectPath(configDir: string, maybeRelative: string): string {
  if (isAbsolute(maybeRelative)) {
    return maybeRelative;
  }
  return resolve(configDir, maybeRelative);
}

/**
 * Locate an a11yst config file by walking up from `cwd`.
 */
export function findConfigPath(cwd: string = process.cwd()): string | null {
  let current = resolve(cwd);

  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = join(current, filename);
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function importConfigModule(configPath: string): Promise<unknown> {
  const loadNonce = Date.now();
  const jiti = createJiti(`${import.meta.url}?${loadNonce}`, {
    interopDefault: true,
    // User configs often read process.env (e.g. PORT) at module scope; re-evaluate
    // on every loadConfig call instead of reusing a prior in-process compilation.
    moduleCache: false,
    fsCache: false,
  });

  try {
    // Jiti may inline process.env.* at compile time and cache transforms by source
    // text. Append a per-load marker so env-dependent configs recompile.
    const fileSource = await readFile(configPath, "utf8");
    const normalizedSource = fileSource.replace(
      /import\s*\{\s*defineConfig\s*\}\s*from\s*["']@a11yst\/config["'];?\s*/g,
      "const defineConfig = (config) => config;\n",
    );
    const source = `${normalizedSource}\n/* a11yst-config-load:${loadNonce} */`;
    const evalId = `${configPath}?${loadNonce}`;
    const loaded = jiti.evalModule(source, {
      id: evalId,
      filename: evalId,
    });
    if (
      loaded &&
      typeof loaded === "object" &&
      "default" in loaded &&
      (loaded as { default: unknown }).default !== undefined
    ) {
      return (loaded as { default: unknown }).default;
    }
    return loaded;
  } catch (error) {
    // Fallback for plain ESM JS configs
    try {
      const mod = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`);
      return mod.default ?? mod;
    } catch {
      throw new ConfigError({
        code: "CONFIG_LOAD_FAILED",
        message: `Failed to load configuration from ${configPath}.`,
        path: configPath,
        hint: 'Ensure the file exports a default config via defineConfig from "@a11yst/config".',
        issues: [
          {
            path: configPath,
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      });
    }
  }
}

/**
 * Find, load, validate, and normalise an a11yst configuration.
 */
export async function loadConfig(
  options: LoadConfigOptions = {},
): Promise<ResolvedConfig> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const configPath = options.configPath
    ? resolve(cwd, options.configPath)
    : findConfigPath(cwd);

  if (!configPath) {
    throw new ConfigError({
      code: "CONFIG_NOT_FOUND",
      message: `No ${productMetadata.command}.config.ts found from ${cwd}.`,
      hint: `Run \`${productMetadata.command} init\` in your project root to create one.`,
    });
  }

  if (!existsSync(configPath)) {
    throw new ConfigError({
      code: "CONFIG_NOT_FOUND",
      message: `Configuration file not found: ${configPath}`,
      path: configPath,
      hint: `Run \`${productMetadata.command} init\` to create a starter configuration.`,
    });
  }

  const raw = await importConfigModule(configPath);
  return validateConfig(raw as A11ystConfig, {
    configDir: dirname(configPath),
    configPath,
  });
}
