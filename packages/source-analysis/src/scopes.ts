import type { SourceAnalysisProject, SourceAnalysisScope } from "@a11yst/types";
import { createSourceAnalysisDiagnostic } from "./diagnostics.js";
import { normalizeFramework } from "./framework.js";

function sanitizeRootUri(rootUri: string): string | undefined {
  const trimmed = rootUri.trim().replace(/\\/g, "/");
  if (!trimmed || trimmed.includes("\0")) {
    return undefined;
  }
  if (trimmed === "." || trimmed === "./") {
    return ".";
  }
  const segments = trimmed.split("/").filter((segment) => segment !== "");
  if (segments.some((segment) => segment === "..")) {
    return undefined;
  }
  return segments.join("/");
}

export function buildSourceAnalysisScopes(
  projects: SourceAnalysisProject[],
): { scopes: SourceAnalysisScope[]; diagnostics: ReturnType<typeof createSourceAnalysisDiagnostic>[] } {
  const diagnostics: ReturnType<typeof createSourceAnalysisDiagnostic>[] = [];
  const scopes: SourceAnalysisScope[] = [];

  const sortedProjects = [...projects].sort((left, right) => {
    const idOrder = left.id.localeCompare(right.id);
    if (idOrder !== 0) {
      return idOrder;
    }
    return left.rootUri.localeCompare(right.rootUri);
  });

  for (const project of sortedProjects) {
    const rootUri = sanitizeRootUri(project.rootUri);
    if (!rootUri) {
      diagnostics.push(
        createSourceAnalysisDiagnostic(
          "source-analysis-project-invalid",
          "error",
          "Project scope root URI is invalid",
          { projectId: project.id, framework: project.framework },
        ),
      );
      continue;
    }

    scopes.push({
      id: project.id,
      rootUri,
      ...(project.projectName ? { projectName: project.projectName } : {}),
      ...(project.framework ? { framework: normalizeFramework(project.framework) } : {}),
    });
  }

  if (scopes.length === 0 && projects.length === 0) {
    scopes.push({ id: "repository", rootUri: "." });
  }

  return { scopes, diagnostics };
}

export function resolveProjectForFinding(
  finding: { projectName: string },
  projects: SourceAnalysisProject[],
): SourceAnalysisProject | undefined {
  const matches = projects.filter((project) => project.projectName === finding.projectName || project.id === finding.projectName);
  if (matches.length === 1) {
    return matches[0];
  }
  return matches.sort((left, right) => left.id.localeCompare(right.id))[0];
}
