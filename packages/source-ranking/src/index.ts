export type {
  SourceRankingContext,
  SourceRankingOptions,
  SourceRankingStatus,
  SourceRankingContributionCode,
  SourceRankingContribution,
  RankedSourceLocation,
  SourceRankingResult,
  SourceRankingDiagnostic,
  SourceRankingDiagnosticCode,
} from "@a11yst/types";

export {
  DEFAULT_MINIMUM_RESOLUTION_SCORE,
  DEFAULT_MINIMUM_WINNING_MARGIN,
  DEFAULT_MAX_CANDIDATES,
  DEFAULT_MAX_SIGNALS_PER_CANDIDATE,
  BASE_CONFIDENCE_SCORE,
  POSITIVE_SIGNAL_WEIGHTS,
  NEGATIVE_SIGNAL_WEIGHTS,
} from "./constants.js";

export { SourceRankingValidationError } from "./errors.js";
export { rankSourceMappingCandidates } from "./rank.js";
export { createRankedSourceMappingResult } from "./convert.js";
export { stableSerializeSourceRankingResult } from "./serialize.js";
export { groupCandidatesByMaterialLocation, selectRepresentative } from "./grouping.js";
export { computeGroupScore } from "./scoring.js";
