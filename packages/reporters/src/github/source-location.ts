import { validateSourceLocation } from "@a11yst/sarif";
import type { Finding } from "@a11yst/types";
import type { GitHubAnnotation, GitHubAnnotationDiagnostic } from "./types.js";
import {
  formatReportSourceLocation,
  resolveFindingRecommendationSummary,
  resolveFindingReportSource,
} from "../finding-source-report.js";

function flatLegacyRegion(location: NonNullable<ReturnType<typeof resolveFindingReportSource>["location"]>) {
  return {
    startLine: location.region.start.line,
    startColumn: location.region.start.column,
    endLine: location.region.end?.line,
    endColumn: location.region.end?.column,
  };
}

export function annotationFromFinding(
  finding: Finding | undefined,
  level: GitHubAnnotation["level"],
  title: string,
  message: string,
  fingerprint: string,
  diagnostics: GitHubAnnotationDiagnostic[],
): GitHubAnnotation {
  let composedMessage = message;
  const recommendation = finding ? resolveFindingRecommendationSummary(finding) : undefined;
  if (recommendation?.title) {
    composedMessage = `${composedMessage} Suggested review: ${recommendation.title}.`;
  }

  if (!finding) {
    return { level, title, message: composedMessage, fingerprint };
  }

  const source = resolveFindingReportSource(finding);
  if (source.status === "ambiguous") {
    const count = source.alternatives?.length ?? 0;
    return {
      level,
      title,
      message: `${composedMessage} Source location is ambiguous${count > 0 ? ` (${count} alternatives)` : ""}.`,
      fingerprint,
    };
  }

  if (source.status !== "mapped" || !source.location) {
    return { level, title, message: composedMessage, fingerprint };
  }

  const confidence = source.confidence ?? "medium";
  if (confidence === "medium" || confidence === "low") {
    const locationText = formatReportSourceLocation(source.location);
    return {
      level,
      title,
      message: `${composedMessage} Probable source ${locationText} (${confidence} confidence).`,
      fingerprint,
    };
  }

  const validated = validateSourceLocation({
    uri: source.location.uri,
    ...flatLegacyRegion(source.location),
  });
  if (!validated) {
    diagnostics.push({
      code: "invalid-source-location",
      level: "warning",
      message: `Omitted invalid source location for fingerprint ${fingerprint.slice(0, 8)}.`,
    });
    return { level, title, message: composedMessage, fingerprint };
  }

  return {
    level,
    title,
    message: composedMessage,
    file: validated.uri,
    line: validated.region.startLine,
    ...(validated.region.startColumn !== undefined
      ? { column: validated.region.startColumn }
      : {}),
    ...(validated.region.endLine !== undefined ? { endLine: validated.region.endLine } : {}),
    ...(validated.region.endColumn !== undefined ? { endColumn: validated.region.endColumn } : {}),
    fingerprint,
  };
}
