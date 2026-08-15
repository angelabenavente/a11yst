import type { FindingSourceLocation } from "./types.js";

const UNIX_ABSOLUTE = /^\//;
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;
const FILE_URI = /^file:/i;

export type ValidatedSourceLocation = {
  uri: string;
  region: {
    startLine: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
  };
};

export function normalizeRelativeUri(uri: string): string | undefined {
  const trimmed = uri.trim().replace(/\\/g, "/");
  if (
    !trimmed ||
    UNIX_ABSOLUTE.test(trimmed) ||
    WINDOWS_ABSOLUTE.test(trimmed) ||
    FILE_URI.test(trimmed)
  ) {
    return undefined;
  }
  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === "..")) {
    return undefined;
  }
  return segments.filter((segment) => segment !== "." && segment !== "").join("/");
}

export function validateSourceLocation(
  location: FindingSourceLocation,
): ValidatedSourceLocation | undefined {
  const uri = normalizeRelativeUri(location.uri);
  if (!uri) {
    return undefined;
  }

  const startLine = location.startLine;
  if (!Number.isInteger(startLine) || startLine <= 0) {
    return undefined;
  }

  const region: ValidatedSourceLocation["region"] = { startLine };

  if (location.startColumn !== undefined) {
    if (!Number.isInteger(location.startColumn) || location.startColumn <= 0) {
      return undefined;
    }
    region.startColumn = location.startColumn;
  }

  if (location.endLine !== undefined) {
    if (!Number.isInteger(location.endLine) || location.endLine < startLine) {
      return undefined;
    }
    region.endLine = location.endLine;
  }

  if (location.endColumn !== undefined) {
    if (!Number.isInteger(location.endColumn) || location.endColumn <= 0) {
      return undefined;
    }
    if (region.endLine !== undefined && region.endLine === startLine) {
      const startColumn = region.startColumn ?? 1;
      if (location.endColumn < startColumn) {
        return undefined;
      }
    }
    region.endColumn = location.endColumn;
  }

  return { uri, region };
}

export function readFindingSourceLocation(
  finding: { sourceLocation?: FindingSourceLocation },
): FindingSourceLocation | undefined {
  return finding.sourceLocation;
}
