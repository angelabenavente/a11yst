import type { RankedSourceLocation } from "@a11yst/types";
import { compareConfidence, regionToFlat } from "@a11yst/source-mapping";

export function compareRankedLocations(
  left: RankedSourceLocation,
  right: RankedSourceLocation,
): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const confidenceOrder = compareConfidence(left.effectiveConfidence, right.effectiveConfidence);
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

  const leftColumn = leftFlat.startColumn ?? 0;
  const rightColumn = rightFlat.startColumn ?? 0;
  return leftColumn - rightColumn;
}

export function sortRankedLocations(locations: RankedSourceLocation[]): RankedSourceLocation[] {
  return [...locations].sort(compareRankedLocations);
}
