import { detectProject, detectWorkspace } from "@a11yst/detect";
import type {
  DetectedProject,
  DetectionEvidence,
  DetectionEvidenceType,
  DevServerCandidate,
  Diagnostic,
  FrameworkCandidate,
  ProjectDetectionResult,
  WorkspaceDetectionResult,
} from "@a11yst/types";
import { productMetadata } from "@a11yst/types";
import { formatLabelValue } from "../output.js";

const EVIDENCE_TYPE_LABELS: Readonly<Record<DetectionEvidenceType, string>> = {
  dependency: "Dependency",
  devDependency: "Dev dependency",
  file: "File",
  directory: "Directory",
  "package-script": "Script",
  configuration: "Configuration",
  workspace: "Workspace",
  fallback: "Fallback",
};

function isWorkspaceResult(
  result: ProjectDetectionResult | WorkspaceDetectionResult,
): result is WorkspaceDetectionResult {
  return "projects" in result;
}

/**
 * Run static detection for `options.cwd`. A thin pass-through to
 * `@a11yst/detect` — no additional heuristics live here.
 */
export async function runDetect(options: {
  cwd: string;
  workspace?: boolean;
}): Promise<ProjectDetectionResult | WorkspaceDetectionResult> {
  if (options.workspace) {
    return detectWorkspace({ cwd: options.cwd });
  }
  return detectProject({ cwd: options.cwd });
}

function isAmbiguous(project: DetectedProject): boolean {
  const framework = project.framework;
  if (framework.diagnostics.some((d) => d.code === "FRAMEWORK_AMBIGUOUS")) {
    return true;
  }
  return (
    (framework.confidence === "medium" || framework.confidence === "low") &&
    framework.alternatives.length > 0
  );
}

function formatEvidenceLines(evidence: readonly DetectionEvidence[]): string[] {
  if (evidence.length === 0) {
    return [];
  }
  return [
    "Evidence",
    ...evidence.map((item) => `- ${EVIDENCE_TYPE_LABELS[item.type]}: ${item.value}`),
  ];
}

function formatDiagnosticsLines(diagnostics: readonly Diagnostic[]): string[] {
  if (diagnostics.length === 0) {
    return [];
  }
  const lines = ["Diagnostics"];
  for (const diagnostic of diagnostics) {
    lines.push(`- [${diagnostic.code}] ${diagnostic.message}`);
    if (diagnostic.hint) {
      lines.push(`  Hint: ${diagnostic.hint}`);
    }
  }
  return lines;
}

function formatProjectLines(project: DetectedProject): string[] {
  const framework = project.framework;
  const ambiguous = isAmbiguous(project);
  const bestDevServer: DevServerCandidate | undefined = project.devServers[0];
  const topAlternative: FrameworkCandidate | undefined = framework.alternatives[0];

  const lines: string[] = [ambiguous ? "Framework detection is ambiguous." : "Project detection", ""];

  lines.push(formatLabelValue("Root", project.relativeRoot));
  lines.push(formatLabelValue("Platform", framework.platform));
  if (ambiguous) {
    lines.push(formatLabelValue("Selected", framework.framework));
    if (topAlternative) {
      lines.push(formatLabelValue("Alternative", topAlternative.framework));
    }
  } else {
    lines.push(formatLabelValue("Framework", framework.framework));
  }
  lines.push(formatLabelValue("Support", framework.supportLevel));
  lines.push(formatLabelValue("Confidence", framework.confidence));
  lines.push(formatLabelValue("Package mgr", project.packageManager.name));
  if (bestDevServer?.command) {
    lines.push(formatLabelValue("Dev command", bestDevServer.command));
  }
  if (bestDevServer?.inferredUrl) {
    lines.push(formatLabelValue("URL", bestDevServer.inferredUrl));
    if (bestDevServer.inferredUrlSource) {
      lines.push(formatLabelValue("URL source", bestDevServer.inferredUrlSource));
    }
  }

  const evidenceLines = formatEvidenceLines(framework.evidence);
  if (evidenceLines.length > 0) {
    lines.push("", ...evidenceLines);
  }

  const allDiagnostics = [
    ...project.diagnostics,
    ...framework.diagnostics,
    ...project.packageManager.diagnostics,
  ];
  const diagnosticsLines = formatDiagnosticsLines(allDiagnostics);
  if (diagnosticsLines.length > 0) {
    lines.push("", ...diagnosticsLines);
  }

  return lines;
}

export function formatDetectHuman(
  result: ProjectDetectionResult | WorkspaceDetectionResult,
): string {
  if (!isWorkspaceResult(result)) {
    return formatProjectLines(result.project).join("\n");
  }

  const lines: string[] = ["Workspace detection", ""];
  lines.push(formatLabelValue("Root", result.workspaceRoot));
  lines.push(formatLabelValue("Package mgr", result.packageManager.name));
  lines.push(formatLabelValue("Projects", String(result.projects.length)));

  if (result.projects.length === 0) {
    lines.push("", "No auditable projects were found.");
  } else {
    for (const project of result.projects) {
      lines.push("");
      lines.push(`- ${project.relativeRoot}`);
      lines.push(`    ${formatLabelValue("Platform", project.framework.platform, 12)}`);
      lines.push(`    ${formatLabelValue("Framework", project.framework.framework, 12)}`);
      lines.push(`    ${formatLabelValue("Confidence", project.framework.confidence, 12)}`);
    }
  }

  const diagnosticsLines = formatDiagnosticsLines(result.diagnostics);
  if (diagnosticsLines.length > 0) {
    lines.push("", ...diagnosticsLines);
  }

  return lines.join("\n");
}

function serializeEvidence(evidence: readonly DetectionEvidence[]): unknown[] {
  return evidence.map((item) => ({
    type: item.type,
    value: item.value,
    description: item.description,
    weight: item.weight,
  }));
}

function serializeDiagnostics(diagnostics: readonly Diagnostic[]): unknown[] {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    hint: diagnostic.hint,
    path: diagnostic.path,
  }));
}

function serializeFrameworkCandidate(candidate: FrameworkCandidate): unknown {
  return {
    framework: candidate.framework,
    score: candidate.score,
    evidence: serializeEvidence(candidate.evidence),
  };
}

function serializeDevServer(devServer: DevServerCandidate): unknown {
  return {
    command: devServer.command,
    sourceScript: devServer.sourceScript,
    confidence: devServer.confidence,
    inferredPort: devServer.inferredPort,
    inferredUrl: devServer.inferredUrl,
    evidence: serializeEvidence(devServer.evidence),
  };
}

function serializeProject(project: DetectedProject): unknown {
  return {
    name: project.name,
    rootDir: project.rootDir,
    relativeRoot: project.relativeRoot,
    isLibrary: project.isLibrary,
    framework: {
      platform: project.framework.platform,
      framework: project.framework.framework,
      supportLevel: project.framework.supportLevel,
      confidence: project.framework.confidence,
      score: project.framework.score,
      evidence: serializeEvidence(project.framework.evidence),
      alternatives: project.framework.alternatives.map(serializeFrameworkCandidate),
      diagnostics: serializeDiagnostics(project.framework.diagnostics),
    },
    packageManager: {
      name: project.packageManager.name,
      confidence: project.packageManager.confidence,
      evidence: serializeEvidence(project.packageManager.evidence),
      diagnostics: serializeDiagnostics(project.packageManager.diagnostics),
    },
    devServers: project.devServers.map(serializeDevServer),
    diagnostics: serializeDiagnostics(project.diagnostics),
  };
}

export function formatDetectJson(
  result: ProjectDetectionResult | WorkspaceDetectionResult,
): unknown {
  if (isWorkspaceResult(result)) {
    return {
      kind: "workspace",
      product: productMetadata.name,
      cwd: result.cwd,
      workspaceRoot: result.workspaceRoot,
      packageManager: {
        name: result.packageManager.name,
        confidence: result.packageManager.confidence,
        evidence: serializeEvidence(result.packageManager.evidence),
        diagnostics: serializeDiagnostics(result.packageManager.diagnostics),
      },
      projects: result.projects.map(serializeProject),
      diagnostics: serializeDiagnostics(result.diagnostics),
    };
  }

  return {
    kind: "project",
    product: productMetadata.name,
    cwd: result.cwd,
    rootDir: result.rootDir,
    project: serializeProject(result.project),
    diagnostics: serializeDiagnostics(result.diagnostics),
  };
}
