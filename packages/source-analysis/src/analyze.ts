import type {
  EnrichedFinding,
  Finding,
  SourceAnalysisInput,
  SourceAnalysisOptions,
  SourceAnalysisResult,
  SourceAnalysisSummary,
} from "@a11yst/types";
import { createAccessibilityRecommendations } from "@a11yst/recommendations";
import { indexRepositorySources } from "@a11yst/source-index";
import { DEFAULT_SOURCE_ANALYSIS_OPTIONS } from "./constants.js";
import { CatalogCache, buildRequiredCatalogs } from "./catalogs.js";
import { createSourceAnalysisDiagnostic, sortSourceAnalysisDiagnostics } from "./diagnostics.js";
import {
  createRecommendationInputFromFinding,
  createSourceMappingEvidenceFromFinding,
  hasExactExistingSourceLocation,
} from "./evidence.js";
import { isSupportedMapperFramework, normalizeFramework, type NormalizedFramework } from "./framework.js";
import { invokePrimaryMapper } from "./mapper.js";
import { applyRanking, shouldRunRanking } from "./ranking.js";
import { buildSourceAnalysisScopes, resolveProjectForFinding } from "./scopes.js";

function resolveOptions(options?: SourceAnalysisOptions): Required<SourceAnalysisOptions> {
  return {
    enabled: options?.enabled ?? DEFAULT_SOURCE_ANALYSIS_OPTIONS.enabled,
    ranking: options?.ranking ?? DEFAULT_SOURCE_ANALYSIS_OPTIONS.ranking,
    recommendations: options?.recommendations ?? DEFAULT_SOURCE_ANALYSIS_OPTIONS.recommendations,
  };
}

function emptySummary(status: SourceAnalysisSummary["status"], diagnostics: SourceAnalysisSummary["diagnostics"]): SourceAnalysisSummary {
  return {
    version: 1,
    status,
    projects: 0,
    indexedFiles: 0,
    analyzedFindings: 0,
    mappedFindings: 0,
    ambiguousFindings: 0,
    unmappedFindings: 0,
    invalidFindings: 0,
    rankedFindings: 0,
    resolvedByRanking: 0,
    recommendedFindings: 0,
    manualReviewFindings: 0,
    unsupportedRecommendationFindings: 0,
    diagnostics,
  };
}

function frameworksFromProjects(projects: SourceAnalysisInput["projects"]): Set<NormalizedFramework> {
  const frameworks = new Set<NormalizedFramework>();
  for (const project of projects) {
    const framework = normalizeFramework(project.framework);
    if (isSupportedMapperFramework(framework)) {
      frameworks.add(framework);
    }
  }
  return frameworks;
}

function enrichFinding(
  finding: Finding,
  enrichment: Partial<EnrichedFinding>,
): EnrichedFinding {
  return {
    ...finding,
    ...(enrichment.sourceMapping ? { sourceMapping: enrichment.sourceMapping } : {}),
    ...(enrichment.sourceRanking ? { sourceRanking: enrichment.sourceRanking } : {}),
    ...(enrichment.recommendations ? { recommendations: enrichment.recommendations } : {}),
  };
}

export async function analyzeFindingSources(input: SourceAnalysisInput): Promise<SourceAnalysisResult> {
  const options = resolveOptions(input.options);
  const diagnostics: SourceAnalysisSummary["diagnostics"] = [];

  if (!options.enabled) {
    diagnostics.push(createSourceAnalysisDiagnostic("source-analysis-disabled", "info", "Source analysis is disabled"));
    return {
      findings: [...input.findings],
      summary: emptySummary("disabled", sortSourceAnalysisDiagnostics(diagnostics)),
    };
  }

  if (input.findings.length === 0) {
    diagnostics.push(createSourceAnalysisDiagnostic("source-analysis-no-findings", "info", "No findings to analyze"));
    return {
      findings: [],
      summary: emptySummary("complete", sortSourceAnalysisDiagnostics(diagnostics)),
    };
  }

  const { scopes, diagnostics: scopeDiagnostics } = buildSourceAnalysisScopes(input.projects);
  diagnostics.push(...scopeDiagnostics);
  if (scopeDiagnostics.some((entry) => entry.level === "error")) {
    return {
      findings: [...input.findings],
      summary: {
        ...emptySummary("invalid", sortSourceAnalysisDiagnostics(diagnostics)),
        projects: scopes.length,
      },
    };
  }

  const supportedFrameworks = frameworksFromProjects(input.projects);
  if (supportedFrameworks.size === 0) {
    diagnostics.push(
      createSourceAnalysisDiagnostic(
        "source-analysis-framework-unsupported",
        "info",
        "No supported framework was detected for source analysis",
      ),
    );
    return {
      findings: [...input.findings],
      summary: {
        ...emptySummary("unsupported", sortSourceAnalysisDiagnostics(diagnostics)),
        projects: scopes.length,
        analyzedFindings: input.findings.length,
      },
    };
  }

  let indexResult;
  try {
    indexResult = await indexRepositorySources({
      repositoryRoot: input.repositoryRoot,
      scopes,
    });
  } catch {
    diagnostics.push(createSourceAnalysisDiagnostic("source-analysis-unexpected-error", "error", "Source index failed unexpectedly"));
    return {
      findings: [...input.findings],
      summary: {
        ...emptySummary("invalid", sortSourceAnalysisDiagnostics(diagnostics)),
        projects: scopes.length,
      },
    };
  }

  if (indexResult.status === "invalid") {
    diagnostics.push(createSourceAnalysisDiagnostic("source-analysis-index-invalid", "error", "Source index is invalid"));
    return {
      findings: [...input.findings],
      summary: {
        ...emptySummary("invalid", sortSourceAnalysisDiagnostics(diagnostics)),
        projects: scopes.length,
      },
    };
  }

  if (indexResult.status === "partial") {
    diagnostics.push(createSourceAnalysisDiagnostic("source-analysis-index-partial", "warning", "Source index completed with partial status"));
  }

  const cache = new CatalogCache(input.repositoryRoot, indexResult);
  const scopeIds = scopes.map((scope) => scope.id);
  let catalogPartial = false;
  try {
    const catalogResult = await buildRequiredCatalogs(cache, supportedFrameworks, scopeIds);
    diagnostics.push(...catalogResult.diagnostics);
    catalogPartial = catalogResult.partial;
  } catch {
    diagnostics.push(createSourceAnalysisDiagnostic("source-analysis-unexpected-error", "error", "Catalog build failed unexpectedly"));
    return {
      findings: [...input.findings],
      summary: {
        ...emptySummary("partial", sortSourceAnalysisDiagnostics(diagnostics)),
        projects: scopes.length,
        indexedFiles: indexResult.summary.indexedFiles,
        analyzedFindings: input.findings.length,
      },
    };
  }

  const counters = {
    mappedFindings: 0,
    ambiguousFindings: 0,
    unmappedFindings: 0,
    invalidFindings: 0,
    rankedFindings: 0,
    resolvedByRanking: 0,
    recommendedFindings: 0,
    manualReviewFindings: 0,
    unsupportedRecommendationFindings: 0,
  };

  const enrichedFindings: EnrichedFinding[] = [];

  for (const [index, finding] of input.findings.entries()) {
    input.onFindingProgress?.(index + 1, input.findings.length);
    const project = resolveProjectForFinding(finding, input.projects);
    const framework = normalizeFramework(project?.framework);
    const existingExact = hasExactExistingSourceLocation(finding);

    if (!isSupportedMapperFramework(framework)) {
      counters.unmappedFindings += 1;
      enrichedFindings.push(enrichFinding(finding, {}));
      continue;
    }

    let sourceMapping;
    const evidence = createSourceMappingEvidenceFromFinding(finding, project);
    try {
      const catalogResult = await buildRequiredCatalogs(
        cache,
        new Set([framework]),
        project ? [project.id] : scopeIds,
      );
      sourceMapping = await invokePrimaryMapper(framework, catalogResult.catalogs, evidence);
    } catch {
      diagnostics.push(
        createSourceAnalysisDiagnostic(
          "source-analysis-mapper-failed",
          "warning",
          "Source mapper failed for a finding",
          { findingFingerprint: finding.fingerprint, framework, projectId: project?.id },
        ),
      );
      counters.unmappedFindings += 1;
      enrichedFindings.push(enrichFinding(finding, {}));
      continue;
    }

    let sourceRanking = undefined;
    if (shouldRunRanking(sourceMapping, existingExact, options.ranking)) {
      try {
        counters.rankedFindings += 1;
        const ranked = applyRanking(sourceMapping, {
          expectedFramework: framework,
          scopeIds: project ? [project.id] : scopeIds,
          routePattern: finding.route,
          elementTag: typeof evidence.tagName === "string" ? evidence.tagName : undefined,
        });
        sourceMapping = ranked.mapping;
        sourceRanking = ranked.ranking;
        if (sourceRanking?.status === "resolved") {
          counters.resolvedByRanking += 1;
        }
      } catch {
        diagnostics.push(
          createSourceAnalysisDiagnostic(
            "source-analysis-ranking-failed",
            "warning",
            "Source ranking failed for a finding",
            { findingFingerprint: finding.fingerprint, framework, projectId: project?.id },
          ),
        );
      }
    }

    switch (sourceMapping.status) {
      case "mapped":
        counters.mappedFindings += 1;
        break;
      case "ambiguous":
        counters.ambiguousFindings += 1;
        diagnostics.push(
          createSourceAnalysisDiagnostic(
            "source-analysis-finding-ambiguous",
            "info",
            "Finding source location is ambiguous",
            { findingFingerprint: finding.fingerprint, framework, projectId: project?.id },
          ),
        );
        break;
      case "invalid":
        counters.invalidFindings += 1;
        diagnostics.push(
          createSourceAnalysisDiagnostic(
            "source-analysis-finding-invalid",
            "warning",
            "Finding source mapping is invalid",
            { findingFingerprint: finding.fingerprint, framework, projectId: project?.id },
          ),
        );
        break;
      default:
        counters.unmappedFindings += 1;
        break;
    }

    let recommendations = undefined;
    if (options.recommendations) {
      try {
        recommendations = createAccessibilityRecommendations(
          createRecommendationInputFromFinding(finding, project, sourceMapping, sourceRanking),
        );
        if (recommendations.status === "recommended") {
          counters.recommendedFindings += 1;
        } else if (recommendations.status === "manual-review") {
          counters.manualReviewFindings += 1;
        } else if (recommendations.status === "unsupported") {
          counters.unsupportedRecommendationFindings += 1;
        }
      } catch {
        diagnostics.push(
          createSourceAnalysisDiagnostic(
            "source-analysis-recommendation-failed",
            "warning",
            "Recommendation generation failed for a finding",
            { findingFingerprint: finding.fingerprint, framework, projectId: project?.id },
          ),
        );
      }
    }

    enrichedFindings.push(
      enrichFinding(finding, {
        sourceMapping,
        ...(sourceRanking ? { sourceRanking } : {}),
        ...(recommendations ? { recommendations } : {}),
      }),
    );
  }

  let status: SourceAnalysisSummary["status"] = "complete";
  if (indexResult.status === "partial" || catalogPartial) {
    status = "partial";
  }

  return {
    findings: enrichedFindings,
    summary: {
      version: 1,
      status,
      projects: scopes.length,
      indexedFiles: indexResult.summary.indexedFiles,
      analyzedFindings: input.findings.length,
      diagnostics: sortSourceAnalysisDiagnostics(diagnostics),
      ...counters,
    },
  };
}
