/**
 * Source analysis orchestration contracts.
 * Implementation lives in `@a11yst/source-analysis`.
 */

import type { Finding } from "./config.js";
import type { SourceIndexScope } from "./source-index.js";
import type { RecommendationResult } from "./recommendations.js";
import type { SourceMappingResult } from "./source-mapping.js";
import type { SourceRankingResult } from "./source-ranking.js";

export type SourceAnalysisOptions = {
  enabled?: boolean;
  ranking?: boolean;
  recommendations?: boolean;
};

export type ResolvedSourceAnalysisConfig = {
  enabled: boolean;
  ranking: boolean;
  recommendations: boolean;
};

export type SourceAnalysisProject = {
  id: string;
  rootUri: string;
  projectName?: string;
  framework?: string;
};

export type SourceAnalysisStatus =
  | "complete"
  | "partial"
  | "disabled"
  | "unsupported"
  | "invalid";

export type SourceAnalysisDiagnosticCode =
  | "source-analysis-disabled"
  | "source-analysis-no-findings"
  | "source-analysis-framework-unsupported"
  | "source-analysis-project-invalid"
  | "source-analysis-index-invalid"
  | "source-analysis-index-partial"
  | "source-analysis-catalog-partial"
  | "source-analysis-mapper-failed"
  | "source-analysis-ranking-failed"
  | "source-analysis-recommendation-failed"
  | "source-analysis-finding-unmapped"
  | "source-analysis-finding-ambiguous"
  | "source-analysis-finding-invalid"
  | "source-analysis-unexpected-error";

export type SourceAnalysisDiagnostic = {
  code: SourceAnalysisDiagnosticCode;
  level: "info" | "warning" | "error";
  message: string;
  projectId?: string;
  findingFingerprint?: string;
  framework?: string;
};

export type SourceAnalysisSummary = {
  version: 1;
  status: SourceAnalysisStatus;
  projects: number;
  indexedFiles: number;
  analyzedFindings: number;
  mappedFindings: number;
  ambiguousFindings: number;
  unmappedFindings: number;
  invalidFindings: number;
  rankedFindings: number;
  resolvedByRanking: number;
  recommendedFindings: number;
  manualReviewFindings: number;
  unsupportedRecommendationFindings: number;
  diagnostics: SourceAnalysisDiagnostic[];
};

export type SourceAnalysisInput = {
  repositoryRoot: string;
  projects: SourceAnalysisProject[];
  findings: Finding[];
  options?: SourceAnalysisOptions;
  onFindingProgress?: (current: number, total: number) => void;
};

export type SourceAnalysisResult = {
  findings: Finding[];
  summary: SourceAnalysisSummary;
};

export type SourceAnalysisScope = SourceIndexScope;

export type EnrichedFinding = Finding & {
  sourceMapping?: SourceMappingResult;
  sourceRanking?: SourceRankingResult;
  recommendations?: RecommendationResult;
};
