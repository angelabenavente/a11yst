import type {
  SourceMappingCandidate,
  SourceMappingDiagnostic,
} from "@a11yst/types";
import {
  compareConfidence,
  compareProvenance,
} from "./confidence-provenance.js";
import { candidateDedupeKey, regionToFlat } from "./location.js";
import { mergeSignals } from "./signals.js";

export function compareCandidates(
  left: SourceMappingCandidate,
  right: SourceMappingCandidate,
): number {
  const confidenceOrder = compareConfidence(left.confidence, right.confidence);
  if (confidenceOrder !== 0) {
    return confidenceOrder;
  }

  const uriOrder = left.location.uri.localeCompare(right.location.uri);
  if (uriOrder !== 0) {
    return uriOrder;
  }

  const leftFlat = regionToFlat(left.location.region);
  const rightFlat = regionToFlat(right.location.region);

  if (leftFlat.startLine !== rightFlat.startLine) {
    return leftFlat.startLine - rightFlat.startLine;
  }

  const leftStartColumn = leftFlat.startColumn ?? 0;
  const rightStartColumn = rightFlat.startColumn ?? 0;
  if (leftStartColumn !== rightStartColumn) {
    return leftStartColumn - rightStartColumn;
  }

  const leftEndLine = leftFlat.endLine ?? 0;
  const rightEndLine = rightFlat.endLine ?? 0;
  if (leftEndLine !== rightEndLine) {
    return leftEndLine - rightEndLine;
  }

  const leftEndColumn = leftFlat.endColumn ?? 0;
  const rightEndColumn = rightFlat.endColumn ?? 0;
  if (leftEndColumn !== rightEndColumn) {
    return leftEndColumn - rightEndColumn;
  }

  return compareProvenance(left.provenance, right.provenance);
}

export function sortCandidates(candidates: SourceMappingCandidate[]): SourceMappingCandidate[] {
  return [...candidates].sort(compareCandidates);
}

const CONFIDENCE_RANK: Record<SourceMappingCandidate["confidence"], number> = {
  exact: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function pickMoreInformative(
  existing: SourceMappingCandidate,
  incoming: SourceMappingCandidate,
): SourceMappingCandidate {
  const existingRank = CONFIDENCE_RANK[existing.confidence] ?? 0;
  const incomingRank = CONFIDENCE_RANK[incoming.confidence] ?? 0;

  const base =
    incomingRank > existingRank
      ? incoming
      : incomingRank < existingRank
        ? existing
        : compareCandidates(existing, incoming) <= 0
          ? existing
          : incoming;

  const merged: SourceMappingCandidate = {
    location: base.location,
    confidence: base.confidence,
    provenance: base.provenance,
    signals: mergeSignals(existing.signals, incoming.signals),
  };

  const framework = base.framework ?? existing.framework ?? incoming.framework;
  const adapter = base.adapter ?? existing.adapter ?? incoming.adapter;
  if (framework !== undefined) {
    merged.framework = framework;
  }
  if (adapter !== undefined) {
    merged.adapter = adapter;
  }

  return merged;
}

export function dedupeCandidates(
  candidates: SourceMappingCandidate[],
): { candidates: SourceMappingCandidate[]; duplicateDetected: boolean } {
  const grouped = new Map<string, SourceMappingCandidate>();
  let duplicateDetected = false;

  for (const candidate of candidates) {
    const key = candidateDedupeKey(candidate.location, candidate.provenance);
    const existing = grouped.get(key);
    if (existing) {
      duplicateDetected = true;
      grouped.set(key, pickMoreInformative(existing, candidate));
    } else {
      grouped.set(key, candidate);
    }
  }

  return {
    candidates: sortCandidates([...grouped.values()]),
    duplicateDetected,
  };
}

const DIAGNOSTIC_LEVEL_ORDER: Record<SourceMappingDiagnostic["level"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function compareDiagnostics(
  left: SourceMappingDiagnostic,
  right: SourceMappingDiagnostic,
): number {
  const levelOrder = DIAGNOSTIC_LEVEL_ORDER[left.level] - DIAGNOSTIC_LEVEL_ORDER[right.level];
  if (levelOrder !== 0) {
    return levelOrder;
  }

  const codeOrder = left.code.localeCompare(right.code);
  if (codeOrder !== 0) {
    return codeOrder;
  }

  const uriOrder = (left.uri ?? "").localeCompare(right.uri ?? "");
  if (uriOrder !== 0) {
    return uriOrder;
  }

  return left.message.localeCompare(right.message);
}

export function sortDiagnostics(
  diagnostics: SourceMappingDiagnostic[],
): SourceMappingDiagnostic[] {
  return [...diagnostics].sort(compareDiagnostics);
}

export function mergeDiagnostics(
  ...groups: SourceMappingDiagnostic[][]
): SourceMappingDiagnostic[] {
  const merged = new Map<string, SourceMappingDiagnostic>();

  for (const group of groups) {
    for (const diagnostic of group) {
      const key = `${diagnostic.level}\0${diagnostic.code}\0${diagnostic.uri ?? ""}\0${diagnostic.message}`;
      if (!merged.has(key)) {
        merged.set(key, diagnostic);
      }
    }
  }

  return sortDiagnostics([...merged.values()]);
}
