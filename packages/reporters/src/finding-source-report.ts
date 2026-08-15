import type {
  Finding,
  SourceLocation,
  SourceMappingConfidence,
  SourceMappingProvenance,
} from "@a11yst/types";

export type FindingReportSource = {
  status: "mapped" | "ambiguous" | "unmapped" | "invalid";
  location?: SourceLocation;
  confidence?: SourceMappingConfidence;
  provenance?: SourceMappingProvenance;
  alternatives?: SourceLocation[];
};

export type FindingRecommendationSummary = {
  status: string;
  applicability?: string;
  title?: string;
  summary?: string;
};

const MAX_ALTERNATIVES = 5;

function flatRegion(region: SourceLocation["region"]): {
  startLine: number;
  startColumn?: number;
} {
  return {
    startLine: region.start.line,
    ...(region.start.column !== undefined ? { startColumn: region.start.column } : {}),
  };
}

function candidateLocationKey(location: SourceLocation): string {
  const flat = flatRegion(location.region);
  return `${location.uri}\0${flat.startLine}\0${flat.startColumn ?? ""}`;
}

function readLegacySourceLocation(finding: Finding): SourceLocation | undefined {
  const extension = finding as Finding & {
    sourceLocation?: {
      uri: string;
      startLine: number;
      startColumn?: number;
      endLine?: number;
      endColumn?: number;
    };
  };
  const legacy = extension.sourceLocation;
  if (!legacy?.uri || !legacy.startLine) {
    return undefined;
  }
  return {
    uri: legacy.uri,
    region: {
      start: {
        line: legacy.startLine,
        ...(legacy.startColumn !== undefined ? { column: legacy.startColumn } : {}),
      },
      ...(legacy.endLine !== undefined
        ? {
            end: {
              line: legacy.endLine,
              ...(legacy.endColumn !== undefined ? { column: legacy.endColumn } : {}),
            },
          }
        : {}),
    },
  };
}

function compareLocations(left: SourceLocation, right: SourceLocation): number {
  const uriOrder = left.uri.localeCompare(right.uri);
  if (uriOrder !== 0) {
    return uriOrder;
  }
  const leftFlat = flatRegion(left.region);
  const rightFlat = flatRegion(right.region);
  if (leftFlat.startLine !== rightFlat.startLine) {
    return leftFlat.startLine - rightFlat.startLine;
  }
  return (leftFlat.startColumn ?? 0) - (rightFlat.startColumn ?? 0);
}

function dedupeAlternatives(locations: SourceLocation[]): SourceLocation[] {
  const seen = new Set<string>();
  const result: SourceLocation[] = [];
  for (const location of [...locations].sort(compareLocations)) {
    const key = candidateLocationKey(location);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(location);
    }
  }
  return result.slice(0, MAX_ALTERNATIVES);
}

export function resolveFindingReportSource(finding: Finding): FindingReportSource {
  const mapping = finding.sourceMapping;
  if (mapping?.status === "mapped" && mapping.selected) {
    return {
      status: "mapped",
      location: mapping.selected.location,
      confidence: mapping.selected.confidence,
      provenance: mapping.selected.provenance,
    };
  }

  if (mapping?.status === "invalid") {
    return { status: "invalid" };
  }

  if (mapping?.status === "ambiguous") {
    return {
      status: "ambiguous",
      alternatives: dedupeAlternatives(mapping.candidates.map((candidate) => candidate.location)),
    };
  }

  const legacy = readLegacySourceLocation(finding);
  if (legacy) {
    return {
      status: "mapped",
      location: legacy,
      confidence: "exact",
      provenance: "existing-source-location",
    };
  }

  if (mapping?.status === "unmapped") {
    return { status: "unmapped" };
  }

  return { status: "unmapped" };
}

export function formatReportSourceLocation(location: SourceLocation): string {
  const flat = flatRegion(location.region);
  const column = flat.startColumn !== undefined ? `:${flat.startColumn}` : "";
  return `${location.uri}:${flat.startLine}${column}`;
}

const UNIX_ABSOLUTE = /^\//;
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;

/** Strip absolute or home-like paths from source URIs for human-facing reports. */
export function sanitizeSourceUriForReport(uri: string): string {
  const normalized = uri.replace(/\\/g, "/");
  if (!UNIX_ABSOLUTE.test(normalized) && !WINDOWS_ABSOLUTE.test(normalized)) {
    return normalized;
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length >= 2) {
    return segments.slice(-2).join("/");
  }
  return segments[segments.length - 1] ?? "source";
}

export function formatSafeReportSourceLocation(location: SourceLocation): string {
  return formatReportSourceLocation({
    ...location,
    uri: sanitizeSourceUriForReport(location.uri),
  });
}

export function resolveFindingRecommendationSummary(
  finding: Finding,
): FindingRecommendationSummary | undefined {
  const recommendations = finding.recommendations;
  if (!recommendations || recommendations.recommendations.length === 0) {
    return undefined;
  }
  const primary = recommendations.recommendations[0];
  if (!primary) {
    return undefined;
  }
  return {
    status: recommendations.status,
    applicability: primary.applicability,
    title: primary.title,
    summary: primary.summary,
  };
}
