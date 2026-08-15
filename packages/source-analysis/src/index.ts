import type {
  Finding,
  SourceAnalysisInput,
  SourceAnalysisOptions,
} from "@a11yst/types";

export type {
  SourceAnalysisDiagnostic,
  SourceAnalysisDiagnosticCode,
  SourceAnalysisInput,
  SourceAnalysisOptions,
  SourceAnalysisProject,
  SourceAnalysisResult,
  SourceAnalysisStatus,
  SourceAnalysisSummary,
} from "@a11yst/types";

export { DEFAULT_SOURCE_ANALYSIS_OPTIONS } from "./constants.js";
export { createSourceMappingEvidenceFromFinding, hasExactExistingSourceLocation } from "./evidence.js";
export { normalizeFramework } from "./framework.js";
export { buildSourceAnalysisScopes } from "./scopes.js";
export { analyzeFindingSources } from "./analyze.js";
export { applyRanking, shouldRunRanking } from "./ranking.js";

export function resolveSourceAnalysisOptions(
  options?: SourceAnalysisOptions,
): Required<SourceAnalysisOptions> {
  return {
    enabled: options?.enabled ?? true,
    ranking: options?.ranking ?? true,
    recommendations: options?.recommendations ?? true,
  };
}

export function cloneFindingForAnalysis(finding: Finding): Finding {
  return structuredClone(finding);
}

export function cloneFindingsForAnalysis(findings: Finding[]): Finding[] {
  return findings.map(cloneFindingForAnalysis);
}

export function cloneSourceAnalysisInput(input: SourceAnalysisInput): SourceAnalysisInput {
  return {
    repositoryRoot: input.repositoryRoot,
    projects: input.projects.map((project) => ({ ...project })),
    findings: cloneFindingsForAnalysis(input.findings),
    ...(input.options ? { options: { ...input.options } } : {}),
  };
}
