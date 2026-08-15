import type {
  RankedSourceLocation,
  SourceMappingCandidate,
  SourceRankingContext,
  SourceRankingDiagnostic,
  SourceRankingOptions,
  SourceRankingResult,
} from "@a11yst/types";
import {
  sortCandidates,
  sanitizeSignals,
  validateConfidenceProvenance,
  validateSourceLocation,
} from "@a11yst/source-mapping";
import {
  DEFAULT_MINIMUM_RESOLUTION_SCORE,
  DEFAULT_MINIMUM_WINNING_MARGIN,
} from "./constants.js";
import { createRankingDiagnostic, sortRankingDiagnostics } from "./diagnostics.js";
import { groupCandidatesByMaterialLocation, selectRepresentative } from "./grouping.js";
import { resolveRankingOptions, SourceRankingValidationError } from "./errors.js";
import { sanitizeRankingContext } from "./sanitize.js";
import { computeGroupScore, sortContributions, type ScoreComputation } from "./scoring.js";
import { compareRankedLocations } from "./sort.js";

type RankedGroup = RankedSourceLocation & { scoreInfo: ScoreComputation };

function sanitizeCandidate(candidate: SourceMappingCandidate): SourceMappingCandidate {
  const { signals } = sanitizeSignals(candidate.signals);
  return { ...candidate, signals };
}

function validateCandidate(candidate: SourceMappingCandidate): SourceRankingDiagnostic | undefined {
  try {
    validateConfidenceProvenance(candidate.confidence, candidate.provenance);
    const locationResult = validateSourceLocation({
      uri: candidate.location.uri,
      region: candidate.location.region,
      symbol: candidate.location.symbol,
      component: candidate.location.component,
      language: candidate.location.language,
    });
    if (!locationResult.ok) {
      return createRankingDiagnostic("invalid-ranking-candidate", "error", "Candidate location is invalid", candidate.location.uri);
    }
    return undefined;
  } catch {
    return createRankingDiagnostic("invalid-ranking-candidate", "error", "Candidate metadata is invalid", candidate.location.uri);
  }
}

function canResolveHeuristic(
  group: RankedSourceLocation,
  scoreInfo: ScoreComputation,
  context: SourceRankingContext,
): boolean {
  if (scoreInfo.hasCriticalConflict || scoreInfo.hasOnlyContextEvidence) {
    return false;
  }

  if (group.effectiveConfidence === "low") {
    return context.allowLowConfidenceResolution === true
      && scoreInfo.positiveSignalKinds.size >= 2
      && scoreInfo.strongPositiveKinds.size >= 1
      && scoreInfo.signalEvidenceScore > 0;
  }

  if (group.effectiveConfidence === "high") {
    return scoreInfo.signalEvidenceScore > 0 || scoreInfo.strongPositiveKinds.size > 0;
  }

  if (group.effectiveConfidence === "medium") {
    return scoreInfo.positiveSignalKinds.size >= 2
      && scoreInfo.strongPositiveKinds.size >= 1;
  }

  return false;
}

export function rankSourceMappingCandidates(input: {
  candidates: SourceMappingCandidate[];
  context?: SourceRankingContext;
  options?: SourceRankingOptions;
}): SourceRankingResult {
  const diagnostics: SourceRankingDiagnostic[] = [];
  let context: SourceRankingContext;
  let options: ReturnType<typeof resolveRankingOptions>;

  try {
    context = sanitizeRankingContext(input.context);
    options = resolveRankingOptions(input.options);
  } catch (error) {
    if (error instanceof SourceRankingValidationError) {
      return {
        version: 1,
        status: "invalid",
        ranked: [],
        diagnostics: [createRankingDiagnostic(error.code as SourceRankingDiagnostic["code"], "error", error.message)],
        decision: {
          minimumResolutionScore: DEFAULT_MINIMUM_RESOLUTION_SCORE,
          minimumWinningMargin: DEFAULT_MINIMUM_WINNING_MARGIN,
        },
      };
    }
    throw error;
  }

  const sortedInput = sortCandidates([...input.candidates]);
  let workingCandidates = sortedInput;
  if (workingCandidates.length > options.maxCandidates) {
    workingCandidates = workingCandidates.slice(0, options.maxCandidates);
    diagnostics.push(createRankingDiagnostic("candidate-limit-reached", "warning", "Candidate limit was reached"));
  }

  const validCandidates: SourceMappingCandidate[] = [];
  for (const candidate of workingCandidates) {
    const invalid = validateCandidate(candidate);
    if (invalid) {
      diagnostics.push(invalid);
      continue;
    }
    validCandidates.push(sanitizeCandidate(candidate));
  }

  if (validCandidates.length === 0) {
    return {
      version: 1,
      status: diagnostics.some((entry) => entry.level === "error") ? "invalid" : "insufficient",
      ranked: [],
      diagnostics: sortRankingDiagnostics(diagnostics),
      decision: {
        minimumResolutionScore: options.minimumResolutionScore,
        minimumWinningMargin: options.minimumWinningMargin,
      },
    };
  }

  const groups = groupCandidatesByMaterialLocation(validCandidates);
  const rankedGroups: RankedGroup[] = [];

  for (const group of groups) {
    if (group.candidates.length > 1) {
      diagnostics.push(createRankingDiagnostic(
        "location-evidence-consolidated",
        "info",
        "Multiple candidates consolidated at the same location",
        group.candidates[0]!.location.uri,
      ));
    }

    const { representative, supportingCandidates } = selectRepresentative(group.candidates);
    const scoreInfo = computeGroupScore({
      candidates: group.candidates,
      context,
      maxSignalsPerCandidate: options.maxSignalsPerCandidate,
    });

    if (scoreInfo.degradedConfidence) {
      diagnostics.push(createRankingDiagnostic(
        "confidence-degraded",
        "info",
        "Effective confidence was degraded",
        representative.location.uri,
      ));
    }

    rankedGroups.push({
      location: representative.location,
      representative,
      supportingCandidates,
      score: scoreInfo.score,
      effectiveConfidence: scoreInfo.effectiveConfidence,
      contributions: sortContributions(scoreInfo.contributions),
      scoreInfo,
    });
  }

  const sortedRankedGroups = [...rankedGroups].sort((left, right) => {
    const order = compareRankedLocations(left, right);
    return order;
  });
  const exactGroups = sortedRankedGroups.filter((group) => group.effectiveConfidence === "exact");

  const decision = {
    minimumResolutionScore: options.minimumResolutionScore,
    minimumWinningMargin: options.minimumWinningMargin,
    topScore: sortedRankedGroups[0]?.score,
    runnerUpScore: sortedRankedGroups[1]?.score,
    winningMargin: sortedRankedGroups.length >= 2 ? sortedRankedGroups[0]!.score - sortedRankedGroups[1]!.score : undefined,
  };

  const ranked = sortedRankedGroups.map(({ scoreInfo: _scoreInfo, ...entry }) => entry);

  if (exactGroups.length === 1) {
    const onlyExact = exactGroups[0]!;
    diagnostics.push(createRankingDiagnostic("ranking-resolved", "info", "Exact location resolved", onlyExact.location.uri));
    const selected = ranked.find((entry) =>
      entry.location.uri === onlyExact.location.uri
      && entry.representative.provenance === onlyExact.representative.provenance,
    ) ?? ranked[0];
    return {
      version: 1,
      status: "resolved",
      selected,
      ranked,
      diagnostics: sortRankingDiagnostics(diagnostics),
      decision,
    };
  }

  if (exactGroups.length >= 2) {
    diagnostics.push(createRankingDiagnostic("conflicting-exact-locations", "warning", "Multiple exact locations conflict"));
    diagnostics.push(createRankingDiagnostic("ranking-ambiguous", "info", "Ranking remained ambiguous"));
    return {
      version: 1,
      status: "ambiguous",
      ranked,
      diagnostics: sortRankingDiagnostics(diagnostics),
      decision,
    };
  }

  if (sortedRankedGroups.length === 0) {
    return {
      version: 1,
      status: "insufficient",
      ranked: [],
      diagnostics: sortRankingDiagnostics([
        ...diagnostics,
        createRankingDiagnostic("ranking-insufficient", "info", "Insufficient evidence for ranking"),
      ]),
      decision,
    };
  }

  const top = sortedRankedGroups[0]!;
  const runnerUp = sortedRankedGroups[1];

  if (top.effectiveConfidence === "low" && context.allowLowConfidenceResolution !== true) {
    diagnostics.push(createRankingDiagnostic("low-confidence-resolution-disabled", "info", "Low confidence resolution is disabled"));
    diagnostics.push(createRankingDiagnostic("ranking-insufficient", "info", "Insufficient evidence for ranking"));
    return {
      version: 1,
      status: "insufficient",
      ranked,
      diagnostics: sortRankingDiagnostics(diagnostics),
      decision,
    };
  }

  if (!canResolveHeuristic(top, top.scoreInfo, context)) {
    diagnostics.push(createRankingDiagnostic("ranking-insufficient", "info", "Insufficient evidence for ranking"));
    return {
      version: 1,
      status: "insufficient",
      ranked,
      diagnostics: sortRankingDiagnostics(diagnostics),
      decision,
    };
  }

  if (top.score < options.minimumResolutionScore) {
    diagnostics.push(createRankingDiagnostic("resolution-threshold-not-met", "info", "Resolution score threshold was not met"));
    diagnostics.push(createRankingDiagnostic("ranking-insufficient", "info", "Insufficient evidence for ranking"));
    return {
      version: 1,
      status: "insufficient",
      ranked,
      diagnostics: sortRankingDiagnostics(diagnostics),
      decision,
    };
  }

  if (runnerUp !== undefined) {
    if (top.score === runnerUp.score) {
      diagnostics.push(createRankingDiagnostic("ranking-ambiguous", "info", "Ranking remained ambiguous"));
      return {
        version: 1,
        status: "ambiguous",
        ranked,
        diagnostics: sortRankingDiagnostics(diagnostics),
        decision,
      };
    }

    const margin = top.score - runnerUp.score;
    decision.winningMargin = margin;
    if (margin < options.minimumWinningMargin) {
      diagnostics.push(createRankingDiagnostic("resolution-margin-not-met", "info", "Winning margin was insufficient"));
      diagnostics.push(createRankingDiagnostic("ranking-ambiguous", "info", "Ranking remained ambiguous"));
      return {
        version: 1,
        status: "ambiguous",
        ranked,
        diagnostics: sortRankingDiagnostics(diagnostics),
        decision,
      };
    }

    if (runnerUp.effectiveConfidence === "high" && margin < options.minimumWinningMargin * 2) {
      diagnostics.push(createRankingDiagnostic("critical-signal-conflict", "warning", "Competing high-confidence locations"));
      diagnostics.push(createRankingDiagnostic("ranking-ambiguous", "info", "Ranking remained ambiguous"));
      return {
        version: 1,
        status: "ambiguous",
        ranked,
        diagnostics: sortRankingDiagnostics(diagnostics),
        decision,
      };
    }
  }

  diagnostics.push(createRankingDiagnostic("ranking-resolved", "info", "Candidate has stronger static evidence", top.location.uri));
  const selected = ranked.find((entry) =>
    entry.location.uri === top.location.uri
    && entry.score === top.score
    && entry.representative.provenance === top.representative.provenance,
  ) ?? ranked[0];

  return {
    version: 1,
    status: "resolved",
    selected,
    ranked,
    diagnostics: sortRankingDiagnostics(diagnostics),
    decision,
  };
}
