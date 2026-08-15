import type { SourceMappingResult, SourceRankingContext, SourceRankingResult } from "@a11yst/types";
import { candidateLocationKey } from "@a11yst/source-mapping";
import { createRankedSourceMappingResult, rankSourceMappingCandidates } from "@a11yst/source-ranking";

function materialLocationCount(candidates: SourceMappingResult["candidates"]): number {
  const keys = new Set<string>();
  for (const candidate of candidates) {
    keys.add(candidateLocationKey(candidate.location));
  }
  return keys.size;
}

export function shouldRunRanking(
  mapping: SourceMappingResult,
  existingExact: boolean,
  rankingEnabled: boolean,
): boolean {
  if (!rankingEnabled) {
    return false;
  }
  if (existingExact) {
    return false;
  }
  if (mapping.status === "invalid") {
    return false;
  }
  if (mapping.candidates.length === 0) {
    return false;
  }
  if (mapping.status === "ambiguous") {
    return true;
  }
  return materialLocationCount(mapping.candidates) >= 2;
}

export function applyRanking(
  mapping: SourceMappingResult,
  context: SourceRankingContext,
): { mapping: SourceMappingResult; ranking?: SourceRankingResult } {
  const ranking = rankSourceMappingCandidates({
    candidates: mapping.candidates,
    context,
  });

  if (ranking.status === "resolved" && ranking.selected !== undefined) {
    return {
      mapping: createRankedSourceMappingResult(mapping.candidates, context),
      ranking,
    };
  }

  if (ranking.status === "ambiguous") {
    return {
      mapping: {
        status: "ambiguous",
        candidates: mapping.candidates,
        diagnostics: mapping.diagnostics,
      },
      ranking,
    };
  }

  if (ranking.status === "invalid") {
    return {
      mapping: { status: "invalid", candidates: [], diagnostics: mapping.diagnostics },
      ranking,
    };
  }

  return {
    mapping: {
      status: "unmapped",
      candidates: mapping.candidates,
      diagnostics: mapping.diagnostics,
    },
    ranking,
  };
}
