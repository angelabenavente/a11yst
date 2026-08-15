import type { Finding } from "@a11yst/types";
import { severityRank } from "./severity.js";
import { fingerprintKey } from "./location.js";

const LIFECYCLE_RANK: Record<string, number> = {
  known: 0,
  new: 1,
  regressed: 2,
};

function lifecycleRank(finding: Finding): number {
  const status = finding.baseline?.status;
  if (!status) return -1;
  return LIFECYCLE_RANK[status] ?? -1;
}

/**
 * When duplicate fingerprints appear, keep the variant most likely to produce
 * (or preserve) a policy breach: higher severity, regressed over new, expired
 * classification over non-expired.
 */
export function mergeDuplicateFinding(
  current: Finding,
  candidate: Finding,
): Finding {
  const currentRank = lifecycleRank(current);
  const candidateRank = lifecycleRank(candidate);
  const currentSeverity = severityRank(current.severity);
  const candidateSeverity = severityRank(candidate.severity);
  const currentExpired = current.baseline?.classificationExpired === true;
  const candidateExpired = candidate.baseline?.classificationExpired === true;

  let preferred = current;

  if (candidateSeverity > currentSeverity) {
    preferred = candidate;
  } else if (candidateSeverity < currentSeverity) {
    preferred = current;
  } else if (candidateRank > currentRank) {
    preferred = candidate;
  } else if (candidateRank < currentRank) {
    preferred = current;
  } else if (candidateExpired && !currentExpired) {
    preferred = candidate;
  }

  return preferred;
}

export function dedupeFindings(findings: Finding[]): {
  findings: Finding[];
  duplicateFingerprints: string[];
} {
  const byKey = new Map<string, Finding>();
  const duplicateFingerprints: string[] = [];

  for (const finding of findings) {
    const key = fingerprintKey(finding);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, finding);
      continue;
    }
    duplicateFingerprints.push(finding.fingerprint);
    byKey.set(key, mergeDuplicateFinding(existing, finding));
  }

  return {
    findings: [...byKey.values()],
    duplicateFingerprints: [...new Set(duplicateFingerprints)].sort(),
  };
}
