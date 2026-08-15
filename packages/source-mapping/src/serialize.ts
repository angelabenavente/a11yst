import type { SourceMappingResult } from "@a11yst/types";
import { sortCandidates, sortDiagnostics } from "./compare.js";
import { sortSignals } from "./signals.js";

export function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => omitUndefinedDeep(entry)) as T;
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        result[key] = omitUndefinedDeep(entry);
      }
    }
    return result as T;
  }

  return value;
}

function normalizeCandidate(candidate: SourceMappingResult["candidates"][number]) {
  const normalized = omitUndefinedDeep({
    ...candidate,
    signals: sortSignals(candidate.signals),
    location: omitUndefinedDeep(candidate.location),
  });
  return normalized;
}

/**
 * Produces a JSON-safe, deterministically ordered source mapping result.
 */
export function serializeSourceMappingResult(result: SourceMappingResult): SourceMappingResult {
  const candidates = sortCandidates(result.candidates).map(normalizeCandidate);
  const diagnostics = sortDiagnostics(result.diagnostics);

  const serialized: SourceMappingResult = {
    status: result.status,
    candidates,
    diagnostics,
  };

  if (result.selected !== undefined) {
    const selectedKey = JSON.stringify(normalizeCandidate(result.selected));
    const matched = candidates.find(
      (candidate) => JSON.stringify(candidate) === selectedKey,
    );
    if (matched !== undefined) {
      serialized.selected = matched;
    }
  }

  return omitUndefinedDeep(serialized) as SourceMappingResult;
}

export function stableSerializeSourceMappingResult(result: SourceMappingResult): string {
  return JSON.stringify(serializeSourceMappingResult(result));
}
