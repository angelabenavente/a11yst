import { join } from "node:path";
import { findExistingFile, readTextFile } from "./filesystem.js";

const VITE_CONFIG_FILES = [
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.js",
  "vite.config.mjs",
] as const;

export type ViteConfigPortDetection = {
  port: number;
  sourceFile: string;
  sourceLabel: string;
};

/**
 * Parse a static `server.port` from Vite config source text without executing
 * or importing the config module.
 */
export function parseStaticViteServerPort(content: string): number | undefined {
  const serverBlock = /server\s*:\s*\{([\s\S]*?)\}/m.exec(content);
  if (!serverBlock?.[1]) {
    return undefined;
  }

  const portMatch = /\bport\s*:\s*(\d{2,5})\b/.exec(serverBlock[1]);
  if (!portMatch?.[1]) {
    return undefined;
  }

  const port = Number(portMatch[1]);
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    return undefined;
  }

  return port;
}

/**
 * Detect a statically declared Vite dev-server port from config files on disk.
 */
export function detectStaticViteConfigPort(rootDir: string): ViteConfigPortDetection | undefined {
  const existing = findExistingFile(rootDir, [...VITE_CONFIG_FILES]);
  if (!existing) {
    return undefined;
  }

  const content = readTextFile(join(rootDir, existing));
  if (!content) {
    return undefined;
  }

  const port = parseStaticViteServerPort(content);
  if (port === undefined) {
    return undefined;
  }

  return {
    port,
    sourceFile: existing,
    sourceLabel: `${existing} · server.port`,
  };
}
