import path from "node:path";
import type { ResolvedConfig, ResolvedWebProject, SourceAnalysisProject, ProgressReporter } from "@a11yst/types";
import type { AuditExecutionResult } from "@a11yst/types";
import { analyzeFindingSources } from "@a11yst/source-analysis";

function buildSourceAnalysisProjects(config: ResolvedConfig): SourceAnalysisProject[] {
  return config.projects
    .filter((project): project is ResolvedWebProject => project.platform === "web")
    .map((project) => ({
      id: project.name,
      rootUri: project.rootDir.replace(/\\/g, "/"),
      projectName: project.name,
      framework: project.framework,
    }))
    .sort((left, right) => left.id.localeCompare(right.id) || left.rootUri.localeCompare(right.rootUri));
}

export async function applySourceAnalysis(
  config: ResolvedConfig,
  result: AuditExecutionResult,
  progress?: ProgressReporter,
): Promise<AuditExecutionResult> {
  try {
    progress?.start("Analyzing source…");
    const analysis = await analyzeFindingSources({
      repositoryRoot: config.configDir,
      projects: buildSourceAnalysisProjects(config),
      findings: result.findings,
      options: config.sourceAnalysis,
      onFindingProgress: (current, total) => {
        progress?.progress(current, total, "Mapping findings to source");
      },
    });
    progress?.succeed("Source analysis completed");

    return {
      ...result,
      findings: analysis.findings,
      sourceAnalysis: analysis.summary,
    };
  } catch {
    progress?.fail("Source analysis failed");
    return {
      ...result,
      sourceAnalysis: {
        version: 1,
        status: "partial",
        projects: buildSourceAnalysisProjects(config).length,
        indexedFiles: 0,
        analyzedFindings: result.findings.length,
        mappedFindings: 0,
        ambiguousFindings: 0,
        unmappedFindings: result.findings.length,
        invalidFindings: 0,
        rankedFindings: 0,
        resolvedByRanking: 0,
        recommendedFindings: 0,
        manualReviewFindings: 0,
        unsupportedRecommendationFindings: 0,
        diagnostics: [
          {
            code: "source-analysis-unexpected-error",
            level: "error",
            message: "Source analysis failed unexpectedly",
          },
        ],
      },
    };
  }
}

export function resolveRepositoryRootFromConfig(config: ResolvedConfig): string {
  return path.resolve(config.configDir);
}
