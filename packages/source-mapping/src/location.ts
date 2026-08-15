import type { SourceLocation, SourceRegion } from "@a11yst/types";
import { UnsafeSourceUriError, normalizeSourceUri } from "./normalize-uri.js";
import { validateSourceRegion } from "./validate-region.js";

export function regionToFlat(region: SourceRegion): {
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
} {
  const flat: {
    startLine: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
  } = {
    startLine: region.start.line,
  };

  if (region.start.column !== undefined) {
    flat.startColumn = region.start.column;
  }
  if (region.end !== undefined) {
    flat.endLine = region.end.line;
    if (region.end.column !== undefined) {
      flat.endColumn = region.end.column;
    }
  }

  return flat;
}

export function flatToRegion(flat: {
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}): SourceRegion {
  const start: SourceRegion["start"] = { line: flat.startLine };
  if (flat.startColumn !== undefined) {
    start.column = flat.startColumn;
  }

  const region: SourceRegion = { start };

  if (flat.endLine !== undefined) {
    const end: NonNullable<SourceRegion["end"]> = { line: flat.endLine };
    if (flat.endColumn !== undefined) {
      end.column = flat.endColumn;
    }
    region.end = end;
  }

  return region;
}

export type ValidateSourceLocationResult =
  | { ok: true; location: SourceLocation }
  | { ok: false; code: "invalid-source-uri" | "invalid-source-region" | "unsafe-source-path" };

/**
 * Validates uri and region into a canonical source location.
 */
export function validateSourceLocation(input: {
  uri: string;
  region: SourceRegion;
  symbol?: string;
  component?: string;
  language?: string;
}): ValidateSourceLocationResult {
  let normalizedUri: string;
  try {
    normalizedUri = normalizeSourceUri(input.uri);
  } catch (error) {
    if (error instanceof UnsafeSourceUriError) {
      return {
        ok: false,
        code: error.reason.includes("traversal") ? "unsafe-source-path" : "invalid-source-uri",
      };
    }
    return { ok: false, code: "invalid-source-uri" };
  }

  try {
    const region = validateSourceRegion(input.region);
    const location: SourceLocation = {
      uri: normalizedUri,
      region,
    };

    if (input.symbol !== undefined) {
      location.symbol = input.symbol;
    }
    if (input.component !== undefined) {
      location.component = input.component;
    }
    if (input.language !== undefined) {
      location.language = input.language;
    }

    return { ok: true, location };
  } catch {
    return { ok: false, code: "invalid-source-region" };
  }
}

export function candidateLocationKey(location: SourceLocation): string {
  const flat = regionToFlat(location.region);
  return [
    location.uri,
    flat.startLine,
    flat.startColumn ?? "",
    flat.endLine ?? "",
    flat.endColumn ?? "",
  ].join("\0");
}

export function candidateDedupeKey(
  location: SourceLocation,
  provenance: string,
): string {
  return `${candidateLocationKey(location)}\0${provenance}`;
}
