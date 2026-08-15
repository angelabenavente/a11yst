/**
 * Source candidate ranking contracts.
 * Implementation lives in `@a11yst/source-ranking`.
 */

import type { SourceLocation, SourceMappingCandidate, SourceMappingConfidence } from "./source-mapping.js";

export type SourceRankingContext = {
  expectedFramework?: string;
  expectedAdapter?: string;
  scopeIds?: string[];
  routePattern?: string;
  componentName?: string;
  ownerComponent?: string;
  elementTag?: string;
  preferredUris?: string[];
  allowLowConfidenceResolution?: boolean;
};

export type SourceRankingOptions = {
  minimumResolutionScore?: number;
  minimumWinningMargin?: number;
  maxCandidates?: number;
  maxSignalsPerCandidate?: number;
};

export type SourceRankingStatus = "resolved" | "ambiguous" | "insufficient" | "invalid";

export type SourceRankingContributionCode =
  | "base-confidence"
  | "exact-location"
  | "selector-evidence"
  | "component-evidence"
  | "accessible-name-evidence"
  | "attribute-evidence"
  | "visible-text-evidence"
  | "element-tag-evidence"
  | "route-evidence"
  | "framework-evidence"
  | "adapter-evidence"
  | "scope-evidence"
  | "preferred-uri"
  | "independent-provenance"
  | "independent-signal"
  | "unmatched-signal"
  | "conflicting-signal"
  | "low-confidence"
  | "insufficient-margin"
  | "insufficient-evidence";

export type SourceRankingContribution = {
  code: SourceRankingContributionCode;
  value: number;
  message: string;
};

export type RankedSourceLocation = {
  location: SourceLocation;
  representative: SourceMappingCandidate;
  supportingCandidates: SourceMappingCandidate[];
  score: number;
  effectiveConfidence: SourceMappingConfidence;
  contributions: SourceRankingContribution[];
};

export type SourceRankingDiagnosticCode =
  | "invalid-ranking-options"
  | "invalid-ranking-context"
  | "invalid-ranking-candidate"
  | "candidate-limit-reached"
  | "signal-limit-reached"
  | "duplicate-ranking-candidate"
  | "location-evidence-consolidated"
  | "conflicting-exact-locations"
  | "critical-signal-conflict"
  | "resolution-threshold-not-met"
  | "resolution-margin-not-met"
  | "low-confidence-resolution-disabled"
  | "confidence-degraded"
  | "ranking-resolved"
  | "ranking-ambiguous"
  | "ranking-insufficient";

export type SourceRankingDiagnostic = {
  code: SourceRankingDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  uri?: string;
};

export type SourceRankingResult = {
  version: 1;
  status: SourceRankingStatus;
  selected?: RankedSourceLocation;
  ranked: RankedSourceLocation[];
  diagnostics: SourceRankingDiagnostic[];
  decision: {
    minimumResolutionScore: number;
    minimumWinningMargin: number;
    topScore?: number;
    runnerUpScore?: number;
    winningMargin?: number;
  };
};
