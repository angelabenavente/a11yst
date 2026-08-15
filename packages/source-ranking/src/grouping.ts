import type { SourceMappingCandidate } from "@a11yst/types";
import {
  compareCandidates,
  compareConfidence,
  compareProvenance,
  sortCandidates,
} from "@a11yst/source-mapping";
import { candidateLocationKey } from "@a11yst/source-mapping";

export type MaterialLocationGroup = {
  locationKey: string;
  candidates: SourceMappingCandidate[];
};

function compareRepresentatives(
  left: SourceMappingCandidate,
  right: SourceMappingCandidate,
): number {
  const confidenceOrder = compareConfidence(left.confidence, right.confidence);
  if (confidenceOrder !== 0) {
    return confidenceOrder;
  }

  const provenanceOrder = compareProvenance(left.provenance, right.provenance);
  if (provenanceOrder !== 0) {
    return provenanceOrder;
  }

  const frameworkOrder = (left.framework ?? "").localeCompare(right.framework ?? "");
  if (frameworkOrder !== 0) {
    return frameworkOrder;
  }

  const adapterOrder = (left.adapter ?? "").localeCompare(right.adapter ?? "");
  if (adapterOrder !== 0) {
    return adapterOrder;
  }

  return compareCandidates(left, right);
}

export function groupCandidatesByMaterialLocation(
  candidates: SourceMappingCandidate[],
): MaterialLocationGroup[] {
  const grouped = new Map<string, SourceMappingCandidate[]>();

  for (const candidate of candidates) {
    const key = candidateLocationKey(candidate.location);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(candidate);
    } else {
      grouped.set(key, [candidate]);
    }
  }

  const groups: MaterialLocationGroup[] = [];
  for (const [locationKey, groupCandidates] of grouped.entries()) {
    groups.push({
      locationKey,
      candidates: sortCandidates(groupCandidates),
    });
  }

  groups.sort((left, right) => left.locationKey.localeCompare(right.locationKey));
  return groups;
}

export function selectRepresentative(candidates: SourceMappingCandidate[]): {
  representative: SourceMappingCandidate;
  supportingCandidates: SourceMappingCandidate[];
} {
  const sorted = [...candidates].sort(compareRepresentatives);
  const representative = sorted[0]!;
  const supportingCandidates = sorted.slice(1);
  return { representative, supportingCandidates };
}

export function compareSupportingCandidates(
  left: SourceMappingCandidate,
  right: SourceMappingCandidate,
): number {
  return compareRepresentatives(left, right);
}
