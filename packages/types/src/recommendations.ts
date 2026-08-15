/**
 * Accessibility recommendation contracts.
 * Implementation lives in `@a11yst/recommendations`.
 */

import type { SourceLocation, SourceMappingConfidence, SourceMappingResult } from "./source-mapping.js";
import type { SourceRankingResult } from "./source-ranking.js";
import type { AxeImpact } from "./severity.js";

export type RecommendationStatus = "recommended" | "manual-review" | "unsupported" | "invalid";

export type RecommendationApplicability = "high" | "medium" | "low";

export type RecommendationKind =
  | "code-change"
  | "content-change"
  | "design-review"
  | "manual-test"
  | "configuration-review";

export type RecommendationTargetStatus = "source" | "ambiguous" | "logical" | "unmapped" | "invalid";

export type RecommendationTarget = {
  status: RecommendationTargetStatus;
  location?: SourceLocation;
  alternatives?: SourceLocation[];
  sourceConfidence?: SourceMappingConfidence;
  route?: string;
  flow?: string;
  checkpoint?: string;
  selector?: string;
};

export type RecommendationAction = {
  id: string;
  kind: RecommendationKind;
  title: string;
  description: string;
};

export type RecommendationVerification = {
  id: string;
  title: string;
  description: string;
  mode: "automated" | "keyboard" | "screen-reader" | "visual" | "manual";
};

export type RecommendationExampleLanguage = "html" | "jsx" | "tsx" | "vue" | "angular" | "text";

export type RecommendationExample = {
  language: RecommendationExampleLanguage;
  title: string;
  code: string;
  generic: true;
};

export type AccessibilityRecommendation = {
  id: string;
  ruleId: string;
  status: RecommendationStatus;
  applicability: RecommendationApplicability;
  title: string;
  summary: string;
  rationale: string;
  target: RecommendationTarget;
  actions: RecommendationAction[];
  verification: RecommendationVerification[];
  examples: RecommendationExample[];
  caveats: string[];
  documentationUrl?: string;
};

export type RecommendationDiagnosticCode =
  | "invalid-recommendation-input"
  | "invalid-rule-id"
  | "unsupported-rule"
  | "recommendation-requires-manual-review"
  | "invalid-help-url"
  | "recommendation-target-conflict"
  | "recommendation-target-ambiguous"
  | "recommendation-target-unmapped"
  | "recommendation-target-invalid"
  | "recommendation-target-limit-reached"
  | "recommendation-input-truncated"
  | "recommendation-sensitive-value-redacted"
  | "recommendation-recipe-duplicate"
  | "recommendation-alias-conflict"
  | "recommendation-action-limit-reached"
  | "recommendation-example-limit-reached";

export type RecommendationDiagnostic = {
  code: RecommendationDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  ruleId?: string;
  uri?: string;
};

export type RecommendationResult = {
  version: 1;
  status: RecommendationStatus;
  recommendations: AccessibilityRecommendation[];
  diagnostics: RecommendationDiagnostic[];
};

export type AccessibilityRecommendationInput = {
  ruleId: string;
  impact?: AxeImpact;
  message?: string;
  help?: string;
  helpUrl?: string;
  tags?: string[];
  element?: {
    tagName?: string;
    role?: string;
    accessibleName?: string;
    visibleText?: string;
    attributes?: Record<string, string | boolean | number>;
  };
  context?: {
    framework?: string;
    adapter?: string;
    route?: string;
    flow?: string;
    checkpoint?: string;
    profile?: string;
    viewport?: string;
  };
  sourceMapping?: SourceMappingResult;
  sourceRanking?: SourceRankingResult;
};
