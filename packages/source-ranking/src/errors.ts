import type { SourceRankingOptions } from "@a11yst/types";
import {
  DEFAULT_MAX_CANDIDATES,
  DEFAULT_MAX_SIGNALS_PER_CANDIDATE,
  DEFAULT_MINIMUM_RESOLUTION_SCORE,
  DEFAULT_MINIMUM_WINNING_MARGIN,
} from "./constants.js";

export class SourceRankingValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "SourceRankingValidationError";
    this.code = code;
  }
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0 || !Number.isFinite(value)) {
    throw new SourceRankingValidationError(`${label} must be a positive integer`, "invalid-ranking-options");
  }
  return value;
}

export function resolveRankingOptions(options: SourceRankingOptions = {}): {
  minimumResolutionScore: number;
  minimumWinningMargin: number;
  maxCandidates: number;
  maxSignalsPerCandidate: number;
} {
  return {
    minimumResolutionScore: assertPositiveInteger(
      options.minimumResolutionScore ?? DEFAULT_MINIMUM_RESOLUTION_SCORE,
      "minimumResolutionScore",
    ),
    minimumWinningMargin: assertPositiveInteger(
      options.minimumWinningMargin ?? DEFAULT_MINIMUM_WINNING_MARGIN,
      "minimumWinningMargin",
    ),
    maxCandidates: assertPositiveInteger(
      options.maxCandidates ?? DEFAULT_MAX_CANDIDATES,
      "maxCandidates",
    ),
    maxSignalsPerCandidate: assertPositiveInteger(
      options.maxSignalsPerCandidate ?? DEFAULT_MAX_SIGNALS_PER_CANDIDATE,
      "maxSignalsPerCandidate",
    ),
  };
}
