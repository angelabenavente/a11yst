import path from "node:path";
import { normalizeSourceUri, UnsafeSourceUriError } from "@a11yst/source-mapping";
import {
  DEFAULT_MAX_ATTRIBUTES_PER_ELEMENT,
  DEFAULT_MAX_COMPONENTS,
  DEFAULT_MAX_ELEMENTS_PER_TEMPLATE,
  DEFAULT_MAX_TEMPLATE_FILES,
  DEFAULT_MAX_TEXT_LENGTH,
  DEFAULT_MAX_TYPESCRIPT_FILES,
  MAX_SELECTOR_LENGTH,
  SENSITIVE_VALUE_PATTERNS,
  STRUCTURAL_TAGS,
} from "./constants.js";
import { AngularSourceValidationError } from "./errors.js";

export function assertAbsoluteRepositoryRoot(repositoryRoot: string): void {
  if (typeof repositoryRoot !== "string" || !repositoryRoot.trim()) {
    throw new AngularSourceValidationError(
      "repositoryRoot must be a non-empty string",
      "invalid-angular-mapping-evidence",
    );
  }
  if (!path.isAbsolute(repositoryRoot)) {
    throw new AngularSourceValidationError(
      "repositoryRoot must be an absolute path",
      "invalid-angular-mapping-evidence",
    );
  }
}

export function resolveIndexedPath(canonicalRoot: string, uri: string): string | undefined {
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

export function resolveTemplateUrl(componentDirUri: string, templateUrl: string): string | undefined {
  const normalized = templateUrl.replace(/\\/g, "/");
  if (
    normalized.includes("\0") ||
    normalized.includes("..") ||
    path.isAbsolute(normalized) ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized)
  ) {
    return undefined;
  }
  const joined = path.posix.normalize(`${componentDirUri}/${normalized}`);
  if (joined.startsWith("..") || joined.includes("/../")) {
    return undefined;
  }
  return joined.replace(/^\.\//, "");
}

export function resolveAngularCatalogOptions(
  options: {
    maxTypeScriptFiles?: number;
    maxTemplateFiles?: number;
    maxComponents?: number;
    maxElementsPerTemplate?: number;
    maxAttributesPerElement?: number;
    maxTextLength?: number;
  } = {},
) {
  return {
    maxTypeScriptFiles: assertPositiveInteger(
      options.maxTypeScriptFiles ?? DEFAULT_MAX_TYPESCRIPT_FILES,
      "maxTypeScriptFiles",
    ),
    maxTemplateFiles: assertPositiveInteger(
      options.maxTemplateFiles ?? DEFAULT_MAX_TEMPLATE_FILES,
      "maxTemplateFiles",
    ),
    maxComponents: assertPositiveInteger(options.maxComponents ?? DEFAULT_MAX_COMPONENTS, "maxComponents"),
    maxElementsPerTemplate: assertPositiveInteger(
      options.maxElementsPerTemplate ?? DEFAULT_MAX_ELEMENTS_PER_TEMPLATE,
      "maxElementsPerTemplate",
    ),
    maxAttributesPerElement: assertPositiveInteger(
      options.maxAttributesPerElement ?? DEFAULT_MAX_ATTRIBUTES_PER_ELEMENT,
      "maxAttributesPerElement",
    ),
    maxTextLength: assertPositiveInteger(options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH, "maxTextLength"),
  };
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new AngularSourceValidationError(
      `${label} must be a positive integer`,
      "invalid-angular-mapping-evidence",
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
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("javascript:") || trimmed.startsWith("vbscript:")) {
    return true;
  }
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

export function sanitizeEvidenceText(value: string | undefined, maxLength: number): string | undefined {
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

export function elementSelectorFromComponentSelector(selector: string): string | undefined {
  const trimmed = selector.trim();
  if (!trimmed || /[\s,[\].#>:]/.test(trimmed)) {
    return undefined;
  }
  return trimmed.toLowerCase();
}

export function dirnameUri(uri: string): string {
  const index = uri.lastIndexOf("/");
  return index >= 0 ? uri.slice(0, index) : "";
}

const NATIVE_HTML_TAGS = new Set([
  "a", "abbr", "address", "area", "article", "aside", "audio", "b", "base", "bdi", "bdo", "blockquote",
  "body", "br", "button", "canvas", "caption", "cite", "code", "col", "colgroup", "data", "datalist",
  "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption",
  "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hr", "html", "i",
  "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "menu",
  "meta", "meter", "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param",
  "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "section", "select", "small",
  "source", "span", "strong", "style", "sub", "summary", "sup", "svg", "table", "tbody", "td", "template",
  "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "u", "ul", "var", "video", "wbr",
]);

export function isNativeHtmlTag(tagName: string): boolean {
  const lower = tagName.toLowerCase();
  if (STRUCTURAL_TAGS.has(lower)) {
    return false;
  }
  return NATIVE_HTML_TAGS.has(lower);
}

