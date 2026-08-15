import type { Finding } from "@a11yst/types";
import { severityRank } from "@a11yst/types";
import type { FindingSourceLocation } from "./types.js";
import { readFindingSourceLocation } from "./source-location.js";
import { fingerprintKey } from "./lifecycle.js";

type FindingWithSource = Finding & { sourceLocation?: FindingSourceLocation };

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

  const deduped = [...byKey.values()];
  deduped.sort((a, b) => fingerprintKey(a).localeCompare(fingerprintKey(b)));
  duplicateFingerprints.sort();

  return { findings: deduped, duplicateFingerprints: [...new Set(duplicateFingerprints)] };
}

function mergeDuplicateFinding(current: Finding, candidate: Finding): Finding {
  let winner = current as FindingWithSource;
  let challenger = candidate as FindingWithSource;

  if (severityRank(candidate.severity) > severityRank(current.severity)) {
    winner = challenger;
    challenger = current as FindingWithSource;
  }

  const winnerLifecycle = lifecycleRank(winner.baseline?.status);
  const challengerLifecycle = lifecycleRank(challenger.baseline?.status);
  if (challengerLifecycle > winnerLifecycle) {
    winner = challenger;
  }

  if (challenger.baseline?.classificationExpired && !winner.baseline?.classificationExpired) {
    winner = challenger;
  }

  const challengerSource = readFindingSourceLocation(challenger);
  const winnerSource = readFindingSourceLocation(winner);
  if (challengerSource && !winnerSource) {
    return { ...winner, sourceLocation: challengerSource } as Finding;
  }

  return winner;
}

function lifecycleRank(status: string | undefined): number {
  switch (status) {
    case "regressed":
      return 3;
    case "new":
      return 2;
    case "known":
      return 1;
    default:
      return 0;
  }
}
