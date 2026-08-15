import type { DetectionEvidence } from "@a11yst/types";

/**
 * Sort evidence deterministically by `type`, then `value`, so the same
 * inputs always produce byte-identical evidence ordering regardless of
 * filesystem iteration order or object construction order.
 */
export function sortEvidence(evidence: readonly DetectionEvidence[]): DetectionEvidence[] {
  return [...evidence].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type < b.type ? -1 : 1;
    }
    if (a.value !== b.value) {
      return a.value < b.value ? -1 : 1;
    }
    return a.description < b.description ? -1 : a.description > b.description ? 1 : 0;
  });
}

/** Sum evidence weights, used as a candidate's aggregate score. */
export function sumWeights(evidence: readonly DetectionEvidence[]): number {
  return evidence.reduce((total, item) => total + item.weight, 0);
}
