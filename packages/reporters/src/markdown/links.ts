import type { MarkdownReportDiagnostic } from "./types.js";
import {
  encodeMarkdownLinkTarget,
  escapeMarkdownLinkLabel,
} from "./escape.js";

const UNIX_ABSOLUTE = /^\//;
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;
const FILE_URI = /^file:/i;

export function isSafeRelativeLinkPath(path: string): boolean {
  const trimmed = path.trim().replace(/\\/g, "/");
  if (
    !trimmed ||
    UNIX_ABSOLUTE.test(trimmed) ||
    WINDOWS_ABSOLUTE.test(trimmed) ||
    FILE_URI.test(trimmed)
  ) {
    return false;
  }
  const segments = trimmed.split("/");
  return !segments.some((segment) => segment === ".." || segment === "");
}

export function buildSafeMarkdownLink(
  label: string,
  path: string | undefined,
  diagnostics: MarkdownReportDiagnostic[],
): string {
  if (!path || !isSafeRelativeLinkPath(path)) {
    if (path) {
      diagnostics.push({
        code: "invalid-link",
        level: "warning",
        message: `Omitted unsafe artifact link: ${label}.`,
      });
    }
    return escapeMarkdownLinkLabel(label);
  }
  const encoded = encodeMarkdownLinkTarget(path);
  return `[${escapeMarkdownLinkLabel(label)}](${encoded})`;
}
