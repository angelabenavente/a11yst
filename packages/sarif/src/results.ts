import type { Finding, PolicyEvaluationResult, SourceLocation } from "@a11yst/types";
import type {
  SarifGenerationDiagnostic,
  SarifResult,
} from "./types.js";
import {
  buildLogicalLocation,
  getResultLogicalLocation,
  logicalLocationSortKey,
} from "./logical-location.js";
import {
  isComparableLifecycle,
  mapLifecycleToBaselineState,
} from "./lifecycle.js";
import { mapSeverityToSarifLevel } from "./severity.js";
import {
  MAX_RESULT_MESSAGE_LENGTH,
  pushTruncatedDiagnostic,
  sanitizeText,
  truncateText,
} from "./text.js";
import {
  readFindingSourceLocation,
  validateSourceLocation,
} from "./source-location.js";
import type { FindingSourceLocation } from "./types.js";

const LEVEL_ORDER: Record<SarifResult["level"], number> = {
  error: 0,
  warning: 1,
  note: 2,
  none: 3,
};

type BuildResultsContext = {
  ruleIndexById: Map<string, number>;
  comparisonComplete: boolean;
  policyBreaches: Map<string, PolicyEvaluationResult["breaches"][number]["kind"]>;
  diagnostics: SarifGenerationDiagnostic[];
};

export function buildResults(
  findings: Finding[],
  context: BuildResultsContext,
): SarifResult[] {
  const results = findings.map((finding) =>
    buildResult(finding, context),
  );
  return sortResults(results);
}

function buildResult(finding: Finding, context: BuildResultsContext): SarifResult {
  const ruleIndex = context.ruleIndexById.get(finding.ruleId);
  if (ruleIndex === undefined) {
    throw new Error(`Missing SARIF rule index for ruleId "${finding.ruleId}".`);
  }

  const message = buildResultMessage(finding, context.diagnostics);
  const partialFingerprints = buildPartialFingerprints(finding);
  const properties = buildResultProperties(finding, context);

  const result: SarifResult = {
    ruleId: finding.ruleId,
    ruleIndex,
    level: mapSeverityToSarifLevel(finding.severity),
    message: { text: message },
    partialFingerprints,
    properties,
  };

  const lifecycle = finding.baseline?.status;
  if (context.comparisonComplete && lifecycle && isComparableLifecycle(lifecycle)) {
    result.baselineState = mapLifecycleToBaselineState(lifecycle);
  } else if (lifecycle && !isComparableLifecycle(lifecycle)) {
    context.diagnostics.push({
      code: "unsupported-lifecycle",
      level: "warning",
      message: `Finding "${finding.fingerprint}" has unsupported lifecycle "${lifecycle}".`,
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
    });
  }

  const source = resolvePhysicalSource(finding);
  if (source) {
    const flat = flatRegion(source.region);
    const validated = validateSourceLocation({
      uri: source.uri,
      startLine: flat.startLine,
      startColumn: flat.startColumn,
      endLine: flat.endLine,
      endColumn: flat.endColumn,
    });
    if (validated) {
      result.locations = [
        {
          physicalLocation: {
            artifactLocation: { uri: validated.uri },
            region: validated.region,
          },
        },
      ];
    } else {
      context.diagnostics.push({
        code: "invalid-source-location",
        level: "warning",
        message: `Finding "${finding.fingerprint}" had an invalid source location; physical location omitted.`,
        fingerprint: finding.fingerprint,
        ruleId: finding.ruleId,
      });
      result.locations = [{ logicalLocations: [buildLogicalLocation(finding)] }];
    }
  } else {
    context.diagnostics.push({
      code: "missing-source-location",
      level: "info",
      message: `Finding "${finding.fingerprint}" has no repository source location; logical location metadata was used.`,
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
    });
    result.locations = [{ logicalLocations: [buildLogicalLocation(finding)] }];
  }

  return result;
}

function buildResultMessage(
  finding: Finding,
  diagnostics: SarifGenerationDiagnostic[],
): string {
  let message = sanitizeText(finding.title || finding.description || finding.ruleId);
  if (finding.route) {
    message = `${message} at route ${finding.route}`;
  } else if (finding.flowId && finding.checkpointId) {
    message = `${message} at flow ${finding.flowId} checkpoint ${finding.checkpointId}`;
  }

  const truncated = truncateText(message, MAX_RESULT_MESSAGE_LENGTH);
  if (truncated.truncated) {
    pushTruncatedDiagnostic(diagnostics, {
      ruleId: finding.ruleId,
      fingerprint: finding.fingerprint,
    });
  }
  return truncated.text;
}

function buildPartialFingerprints(finding: Finding): Record<string, string> {
  const version = finding.fingerprintVersion ?? "1";
  return {
    [`a11ystFingerprint/v${version}`]: finding.fingerprint,
  };
}

function buildResultProperties(
  finding: Finding,
  context: BuildResultsContext,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    "a11yst.project": finding.projectName,
    "a11yst.profile": finding.profile,
    "a11yst.severity": finding.severity,
  };

  if (finding.sourceImpact) {
    properties["a11yst.sourceImpact"] = finding.sourceImpact;
  }

  if (finding.viewport) {
    properties["a11yst.viewport"] = finding.viewport;
  }

  if (finding.flowId && finding.checkpointId) {
    properties["a11yst.locationKind"] = "flow-checkpoint";
    properties["a11yst.flowId"] = finding.flowId;
    properties["a11yst.checkpointId"] = finding.checkpointId;
  } else {
    properties["a11yst.locationKind"] = "route";
    if (finding.route) {
      properties["a11yst.route"] = finding.route;
    }
  }

  const lifecycle = finding.baseline?.status;
  if (lifecycle) {
    properties["a11yst.lifecycle"] = lifecycle;
  }
  if (!context.comparisonComplete) {
    properties["a11yst.comparisonComplete"] = false;
  }

  const classification = finding.baseline?.classification;
  if (classification) {
    properties["a11yst.disposition"] = classification.disposition;
    if (finding.baseline?.classificationExpired) {
      properties["a11yst.classificationExpired"] = true;
    }
    if (classification.owner) {
      properties["a11yst.owner"] = classification.owner;
    }
    if (classification.ticket) {
      properties["a11yst.ticket"] = classification.ticket;
    }
    if (classification.expiresAt) {
      properties["a11yst.expiresAt"] = classification.expiresAt;
    }
    if (classification.reviewAt) {
      properties["a11yst.reviewAt"] = classification.reviewAt;
    }
  }

  const breachKind = context.policyBreaches.get(finding.fingerprint);
  if (breachKind) {
    properties["a11yst.policyBreach"] = true;
    properties["a11yst.policyBreachKind"] = breachKind;
  }

  if (finding.sourceMapping?.status === "mapped" && finding.sourceMapping.selected) {
    properties["a11yst.sourceMapping"] = {
      status: finding.sourceMapping.status,
      confidence: finding.sourceMapping.selected.confidence,
      provenance: finding.sourceMapping.selected.provenance,
    };
  } else if (finding.sourceMapping?.status) {
    properties["a11yst.sourceMapping"] = {
      status: finding.sourceMapping.status,
    };
  }

  if (finding.sourceRanking) {
    properties["a11yst.sourceRanking"] = {
      status: finding.sourceRanking.status,
      ...(finding.sourceRanking.decision?.topScore !== undefined
        ? { topScore: finding.sourceRanking.decision.topScore }
        : {}),
      ...(finding.sourceRanking.decision?.winningMargin !== undefined
        ? { winningMargin: finding.sourceRanking.decision.winningMargin }
        : {}),
      ...(finding.sourceRanking.selected?.effectiveConfidence
        ? { effectiveConfidence: finding.sourceRanking.selected.effectiveConfidence }
        : {}),
    };
  }

  if (finding.recommendations?.recommendations.length) {
    properties["a11yst.recommendations"] = {
      status: finding.recommendations.status,
      items: finding.recommendations.recommendations.map((entry) => ({
        id: entry.id,
        applicability: entry.applicability,
        title: entry.title.slice(0, 120),
      })),
    };
  }

  return properties;
}

function flatRegion(region: SourceLocation["region"]): {
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
} {
  return {
    startLine: region.start.line,
    ...(region.start.column !== undefined ? { startColumn: region.start.column } : {}),
    ...(region.end?.line !== undefined ? { endLine: region.end.line } : {}),
    ...(region.end?.column !== undefined ? { endColumn: region.end.column } : {}),
  };
}

function resolvePhysicalSource(finding: Finding): SourceLocation | undefined {
  if (finding.sourceMapping?.status === "mapped" && finding.sourceMapping.selected) {
    return finding.sourceMapping.selected.location;
  }

  const legacy = readFindingSourceLocation(
    finding as Finding & { sourceLocation?: FindingSourceLocation },
  );
  if (!legacy) {
    return undefined;
  }

  return {
    uri: legacy.uri,
    region: {
      start: {
        line: legacy.startLine,
        ...(legacy.startColumn !== undefined ? { column: legacy.startColumn } : {}),
      },
      ...(legacy.endLine !== undefined
        ? {
            end: {
              line: legacy.endLine,
              ...(legacy.endColumn !== undefined ? { column: legacy.endColumn } : {}),
            },
          }
        : {}),
    },
  };
}

export function sortResults(results: SarifResult[]): SarifResult[] {
  return [...results].sort((a, b) => {
    const byLevel = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
    if (byLevel !== 0) return byLevel;
    const byRule = a.ruleId.localeCompare(b.ruleId);
    if (byRule !== 0) return byRule;
    const byProject = String(a.properties?.["a11yst.project"] ?? "").localeCompare(
      String(b.properties?.["a11yst.project"] ?? ""),
    );
    if (byProject !== 0) return byProject;
    const aLogical = getResultLogicalLocation(a);
    const bLogical = getResultLogicalLocation(b);
    const byLogical = logicalLocationSortKey(
      aLogical ?? { name: "" },
    ).localeCompare(logicalLocationSortKey(bLogical ?? { name: "" }));
    if (byLogical !== 0) return byLogical;
    const aFingerprint = Object.values(a.partialFingerprints)[0] ?? "";
    const bFingerprint = Object.values(b.partialFingerprints)[0] ?? "";
    return aFingerprint.localeCompare(bFingerprint);
  });
}

export function countClassifiedResults(findings: Finding[]): number {
  return findings.filter((finding) => finding.baseline?.classification).length;
}

export function countLocatedResults(results: SarifResult[]): number {
  return results.filter((result) =>
    result.locations?.some((location) => location.physicalLocation !== undefined),
  ).length;
}
