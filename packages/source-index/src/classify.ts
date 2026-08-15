import type { SourceFileKind } from "@a11yst/types";
import { GENERATED_FILE_PATTERNS } from "./constants.js";

const ANGULAR_TEMPLATE = /\.component\.html$/i;

const EXTENSION_KIND: Readonly<Record<string, SourceFileKind>> = {
  ".html": "html",
  ".htm": "html",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "jsx",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".vue": "vue",
  ".svelte": "svelte",
  ".astro": "astro",
};

export function extractExtension(uri: string): string {
  const slash = uri.lastIndexOf("/");
  const base = slash >= 0 ? uri.slice(slash + 1) : uri;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot);
}

export function isGeneratedFile(uri: string): boolean {
  return GENERATED_FILE_PATTERNS.some((pattern) => pattern.test(uri));
}

export function classifySourceFile(uri: string): SourceFileKind | undefined {
  if (isGeneratedFile(uri)) {
    return undefined;
  }

  if (ANGULAR_TEMPLATE.test(uri)) {
    return "angular-template";
  }

  const extension = extractExtension(uri);
  if (!extension) {
    return undefined;
  }

  return EXTENSION_KIND[extension.toLowerCase()];
}

export function isSupportedSourceExtension(extension: string): boolean {
  if (!extension) {
    return false;
  }
  const lower = extension.toLowerCase();
  if (lower === ".html" || lower === ".htm") {
    return true;
  }
  return lower in EXTENSION_KIND;
}
