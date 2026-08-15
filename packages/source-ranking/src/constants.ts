import type { SourceMappingConfidence, SourceMappingSignalKind } from "@a11yst/types";

export const DEFAULT_MINIMUM_RESOLUTION_SCORE = 340;
export const DEFAULT_MINIMUM_WINNING_MARGIN = 60;
export const DEFAULT_MAX_CANDIDATES = 500;
export const DEFAULT_MAX_SIGNALS_PER_CANDIDATE = 64;
export const MAX_CONTEXT_STRING_LENGTH = 256;

export const BASE_CONFIDENCE_SCORE: Record<SourceMappingConfidence, number> = {
  exact: 1000,
  high: 300,
  medium: 180,
  low: 80,
};

export const POSITIVE_SIGNAL_WEIGHTS: Partial<Record<SourceMappingSignalKind, number>> = {
  "source-location-present": 300,
  "source-map-resolved": 300,
  selector: 80,
  "component-name": 70,
  "accessible-name": 60,
  attribute: 35,
  "visible-text": 25,
  "element-tag": 10,
  route: 20,
  "framework-metadata": 15,
};

export const NEGATIVE_SIGNAL_WEIGHTS: Partial<Record<SourceMappingSignalKind, number>> = {
  selector: -80,
  "component-name": -60,
  "accessible-name": -50,
  attribute: -25,
  "visible-text": -20,
  "element-tag": -10,
  route: -20,
  "framework-metadata": -15,
};

export const STRONG_SIGNAL_KINDS: ReadonlySet<SourceMappingSignalKind> = new Set([
  "selector",
  "component-name",
  "accessible-name",
  "attribute",
]);

export const CONTEXT_ONLY_SIGNAL_KINDS: ReadonlySet<SourceMappingSignalKind> = new Set([
  "element-tag",
  "route",
  "framework-metadata",
]);

export const SIGNAL_DIVERSITY_BONUS: readonly number[] = [0, 0, 10, 20, 30];
export const PROVENANCE_DIVERSITY_BONUS: readonly number[] = [0, 0, 20, 35];

export const CONTEXT_FRAMEWORK_MATCH = 15;
export const CONTEXT_FRAMEWORK_MISMATCH = -15;
export const CONTEXT_ADAPTER_MATCH = 10;
export const CONTEXT_ADAPTER_MISMATCH = -10;
export const CONTEXT_SCOPE_MATCH = 20;
export const CONTEXT_SCOPE_MISMATCH = -30;
export const CONTEXT_ROUTE_MATCH = 20;
export const CONTEXT_ROUTE_MISMATCH = -20;
export const CONTEXT_COMPONENT_MATCH = 30;
export const CONTEXT_COMPONENT_MISMATCH = -30;
export const CONTEXT_OWNER_MATCH = 30;
export const CONTEXT_OWNER_MISMATCH = -30;
export const CONTEXT_TAG_MATCH = 10;
export const CONTEXT_TAG_MISMATCH = -20;
export const CONTEXT_PREFERRED_URI_MATCH = 10;

export const CONTRIBUTION_CODE_ORDER: readonly string[] = [
  "base-confidence",
  "exact-location",
  "selector-evidence",
  "component-evidence",
  "accessible-name-evidence",
  "attribute-evidence",
  "visible-text-evidence",
  "element-tag-evidence",
  "route-evidence",
  "framework-evidence",
  "adapter-evidence",
  "scope-evidence",
  "preferred-uri",
  "independent-provenance",
  "independent-signal",
  "unmatched-signal",
  "conflicting-signal",
  "low-confidence",
  "insufficient-margin",
  "insufficient-evidence",
];

export const RANKING_DIAGNOSTIC_LEVEL_ORDER: Record<"error" | "warning" | "info", number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export const RANKING_DIAGNOSTIC_CODE_ORDER: readonly string[] = [
  "invalid-ranking-options",
  "invalid-ranking-context",
  "invalid-ranking-candidate",
  "candidate-limit-reached",
  "signal-limit-reached",
  "duplicate-ranking-candidate",
  "location-evidence-consolidated",
  "conflicting-exact-locations",
  "critical-signal-conflict",
  "resolution-threshold-not-met",
  "resolution-margin-not-met",
  "low-confidence-resolution-disabled",
  "confidence-degraded",
  "ranking-resolved",
  "ranking-ambiguous",
  "ranking-insufficient",
];
