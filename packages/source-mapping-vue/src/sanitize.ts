import path from "node:path";
import { normalizeSourceUri, UnsafeSourceUriError } from "@a11yst/source-mapping";
import {
  DEFAULT_MAX_ATTRIBUTES_PER_ELEMENT,
  DEFAULT_MAX_ELEMENTS_PER_FILE,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_TEXT_LENGTH,
  MAX_SELECTOR_LENGTH,
  SENSITIVE_VALUE_PATTERNS,
} from "./constants.js";
import { VueSourceValidationError } from "./errors.js";

export function assertAbsoluteRepositoryRoot(repositoryRoot: string): void {
  if (typeof repositoryRoot !== "string" || !repositoryRoot.trim()) {
    throw new VueSourceValidationError(
      "repositoryRoot must be a non-empty string",
      "invalid-vue-mapping-evidence",
    );
  }
  if (!path.isAbsolute(repositoryRoot)) {
    throw new VueSourceValidationError(
      "repositoryRoot must be an absolute path",
      "invalid-vue-mapping-evidence",
    );
  }
}

export function resolveIndexedVuePath(canonicalRoot: string, uri: string): string | undefined {
  try {
    const normalizedUri = normalizeSourceUri(uri);
    const absolutePath = path.resolve(canonicalRoot, ...normalizedUri.split("/"));
    const relative = path.relative(canonicalRoot, absolutePath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      return undefined;
    }
    return absolutePath;
  } catch (error) {
    if (error instanceof UnsafeSourceUriError) {
      return undefined;
    }
    throw error;
  }
}

export function resolveVueCatalogOptions(
  options: {
    maxFiles?: number;
    maxElementsPerFile?: number;
    maxAttributesPerElement?: number;
    maxTextLength?: number;
  } = {},
) {
  return {
    maxFiles: assertPositiveInteger(options.maxFiles ?? DEFAULT_MAX_FILES, "maxFiles"),
    maxElementsPerFile: assertPositiveInteger(
      options.maxElementsPerFile ?? DEFAULT_MAX_ELEMENTS_PER_FILE,
      "maxElementsPerFile",
    ),
    maxAttributesPerElement: assertPositiveInteger(
      options.maxAttributesPerElement ?? DEFAULT_MAX_ATTRIBUTES_PER_ELEMENT,
      "maxAttributesPerElement",
    ),
    maxTextLength: assertPositiveInteger(
      options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH,
      "maxTextLength",
    ),
  };
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new VueSourceValidationError(
      `${label} must be a positive integer`,
      "invalid-vue-mapping-evidence",
    );
  }
  return value;
}

export function sortStringArray(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function stripControlCharacters(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x1f && code !== 0x7f) {
      result += value[index];
    }
  }
  return result;
}

export function normalizeText(value: string): string {
  return stripControlCharacters(value).replace(/\s+/g, " ").trim();
}

export function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

export function isSensitiveValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

export function sanitizeEvidenceText(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = normalizeText(value);
  if (!normalized || isSensitiveValue(normalized)) {
    return undefined;
  }
  return truncateText(normalized, maxLength);
}

export function sanitizeSelector(selector: string | undefined): string | undefined {
  if (selector === undefined) {
    return undefined;
  }
  const trimmed = stripControlCharacters(selector).trim();
  if (!trimmed || trimmed.length > MAX_SELECTOR_LENGTH) {
    return undefined;
  }
  return trimmed;
}

export function ownerHintFromFilename(uri: string): string | undefined {
  const base = uri.slice(uri.lastIndexOf("/") + 1);
  const name = base.replace(/\.vue$/, "");
  if (!name || name === "index") {
    return undefined;
  }
  return name;
}

export function kebabToPascal(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function pascalToKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

export function componentNameAliases(name: string): string[] {
  const aliases = new Set<string>([name]);
  if (name.includes(".")) {
    aliases.add(name);
  } else if (name.includes("-")) {
    aliases.add(kebabToPascal(name));
  } else if (/[A-Z]/.test(name)) {
    aliases.add(pascalToKebab(name));
  }
  return sortStringArray([...aliases]);
}

export function offsetToPosition(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset && index < source.length; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}
