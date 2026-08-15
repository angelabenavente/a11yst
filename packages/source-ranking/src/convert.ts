import type {
  SourceMappingCandidate,
  SourceMappingDiagnostic,
  SourceMappingResult,
  SourceRankingContext,
  SourceRankingDiagnostic,
  SourceRankingOptions,
} from "@a11yst/types";
import { sortCandidates } from "@a11yst/source-mapping";
import { rankSourceMappingCandidates } from "./rank.js";

function convertDiagnostics(diagnostics: SourceRankingDiagnostic[]): SourceMappingDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    let code: SourceMappingDiagnostic["code"] = "ambiguous-candidates";
    switch (diagnostic.code) {
      case "conflicting-exact-locations":
        code = "conflicting-exact-candidates";
        break;
      case "invalid-ranking-candidate":
      case "invalid-ranking-context":
      case "invalid-ranking-options":
        code = "invalid-source-uri";
        break;
      case "ranking-insufficient":
        code = "missing-source-location";
        break;
      default:
        code = "ambiguous-candidates";
        break;
    }

    const mapped: SourceMappingDiagnostic = {
      code,
      level: diagnostic.level,
      message: diagnostic.message,
    };
    if (diagnostic.uri !== undefined) {
      mapped.uri = diagnostic.uri;
    }
    return mapped;
  });
}

export function createRankedSourceMappingResult(
  candidates: SourceMappingCandidate[],
  context?: SourceRankingContext,
  options?: SourceRankingOptions,
): SourceMappingResult {
  const ranking = rankSourceMappingCandidates({ candidates, context, options });
  const sortedCandidates = sortCandidates([...candidates]);
  const diagnostics = convertDiagnostics(ranking.diagnostics);

  if (ranking.status === "invalid") {
    return {
      status: "invalid",
      candidates: [],
      diagnostics,
    };
  }

  if (ranking.status === "resolved" && ranking.selected !== undefined) {
    return {
      status: "mapped",
      selected: ranking.selected.representative,
      candidates: sortedCandidates,
      diagnostics,
    };
  }

  if (ranking.status === "ambiguous") {
    return {
      status: "ambiguous",
      candidates: sortedCandidates,
      diagnostics,
    };
  }

  return {
    status: "unmapped",
    candidates: sortedCandidates,
    diagnostics,
  };
}
