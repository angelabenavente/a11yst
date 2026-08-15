import type {
  AccessibilityRecommendationInput,
  RecommendationTarget,
  SourceLocation,
  SourceMappingConfidence,
  SourceMappingResult,
  SourceRankingResult,
} from "@a11yst/types";
import { candidateLocationKey, regionToFlat } from "@a11yst/source-mapping";
import { CONFIDENCE_ORDER, MAX_TARGET_ALTERNATIVES } from "./constants.js";
import { createRecommendationDiagnostic } from "./diagnostics.js";
import type { RecommendationDiagnostic } from "@a11yst/types";
import { sanitizeSelector } from "./sanitize.js";

function conservativeConfidence(
  left?: SourceMappingConfidence,
  right?: SourceMappingConfidence,
): SourceMappingConfidence | undefined {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  const leftIndex = CONFIDENCE_ORDER.indexOf(left);
  const rightIndex = CONFIDENCE_ORDER.indexOf(right);
    return CONFIDENCE_ORDER[Math.max(leftIndex, rightIndex)] ?? left;
}

function compareLocations(left: SourceLocation, right: SourceLocation): number {
  const uriOrder = left.uri.localeCompare(right.uri);
  if (uriOrder !== 0) {
    return uriOrder;
  }
  const leftFlat = regionToFlat(left.region);
  const rightFlat = regionToFlat(right.region);
  if (leftFlat.startLine !== rightFlat.startLine) {
    return leftFlat.startLine - rightFlat.startLine;
  }
  return (leftFlat.startColumn ?? 0) - (rightFlat.startColumn ?? 0);
}

function dedupeLocations(locations: SourceLocation[]): SourceLocation[] {
  const seen = new Set<string>();
  const result: SourceLocation[] = [];
  for (const location of locations.sort(compareLocations)) {
    const key = candidateLocationKey(location);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(location);
    }
  }
  return result;
}

function rankingAlternatives(ranking: SourceRankingResult, limit: number): SourceLocation[] {
  const locations = ranking.ranked.map((entry) => entry.location);
  return dedupeLocations(locations).slice(0, limit);
}

function mappingAlternatives(mapping: SourceMappingResult, limit: number): SourceLocation[] {
  const locations = mapping.candidates.map((candidate) => candidate.location);
  return dedupeLocations(locations).slice(0, limit);
}

function logicalContext(input: AccessibilityRecommendationInput): Pick<RecommendationTarget, "route" | "flow" | "checkpoint" | "selector"> {
  const result: Pick<RecommendationTarget, "route" | "flow" | "checkpoint" | "selector"> = {};
  if (input.context?.route) {
    result.route = input.context.route;
  }
  if (input.context?.flow) {
    result.flow = input.context.flow;
  }
  if (input.context?.checkpoint) {
    result.checkpoint = input.context.checkpoint;
  }
  const selector = sanitizeSelector(input.element?.attributes?.["data-testid"] as string | undefined);
  if (selector) {
    result.selector = selector;
  }
  return result;
}

export function resolveRecommendationTarget(input: {
  sourceMapping?: SourceMappingResult;
  sourceRanking?: SourceRankingResult;
  context?: AccessibilityRecommendationInput["context"];
  element?: AccessibilityRecommendationInput["element"];
}): { target: RecommendationTarget; diagnostics: RecommendationDiagnostic[] } {
  const diagnostics: RecommendationDiagnostic[] = [];
  const mapping = input.sourceMapping;
  const ranking = input.sourceRanking;
  const logical = logicalContext({ ruleId: "", context: input.context, element: input.element });

  const rankingResolved = ranking?.status === "resolved" && ranking.selected !== undefined;
  const mappingMapped = mapping?.status === "mapped" && mapping.selected !== undefined;

  if (ranking?.status === "invalid" || mapping?.status === "invalid") {
    diagnostics.push(createRecommendationDiagnostic("recommendation-target-invalid", "error", "Source target is invalid"));
    return { target: { status: "invalid", ...logical }, diagnostics };
  }

  if (rankingResolved && mappingMapped) {
    const rankingKey = candidateLocationKey(ranking!.selected!.location);
    const mappingKey = candidateLocationKey(mapping!.selected!.location);
    if (rankingKey !== mappingKey) {
      diagnostics.push(createRecommendationDiagnostic("recommendation-target-conflict", "warning", "Ranking and mapping selected different locations"));
      const alternatives = dedupeLocations([
        ranking!.selected!.location,
        mapping!.selected!.location,
        ...rankingAlternatives(ranking!, MAX_TARGET_ALTERNATIVES),
        ...mappingAlternatives(mapping!, MAX_TARGET_ALTERNATIVES),
      ]).slice(0, MAX_TARGET_ALTERNATIVES);
      if (alternatives.length > MAX_TARGET_ALTERNATIVES) {
        diagnostics.push(createRecommendationDiagnostic("recommendation-target-limit-reached", "info", "Target alternatives were truncated"));
      }
      diagnostics.push(createRecommendationDiagnostic("recommendation-target-ambiguous", "info", "Source target is ambiguous"));
      return {
        target: {
          status: "ambiguous",
          alternatives,
          sourceConfidence: conservativeConfidence(mapping!.selected!.confidence, ranking!.selected!.effectiveConfidence),
          ...logical,
        },
        diagnostics,
      };
    }

    return {
      target: {
        status: "source",
        location: ranking!.selected!.location,
        sourceConfidence: conservativeConfidence(mapping!.selected!.confidence, ranking!.selected!.effectiveConfidence),
        ...logical,
      },
      diagnostics,
    };
  }

  if (rankingResolved) {
    return {
      target: {
        status: "source",
        location: ranking!.selected!.location,
        sourceConfidence: ranking!.selected!.effectiveConfidence,
        ...logical,
      },
      diagnostics,
    };
  }

  if (mappingMapped) {
    return {
      target: {
        status: "source",
        location: mapping!.selected!.location,
        sourceConfidence: mapping!.selected!.confidence,
        ...logical,
      },
      diagnostics,
    };
  }

  if (ranking?.status === "ambiguous" || mapping?.status === "ambiguous") {
    const alternatives = dedupeLocations([
      ...(ranking ? rankingAlternatives(ranking, MAX_TARGET_ALTERNATIVES) : []),
      ...(mapping ? mappingAlternatives(mapping, MAX_TARGET_ALTERNATIVES) : []),
    ]).slice(0, MAX_TARGET_ALTERNATIVES);
    if (alternatives.length >= MAX_TARGET_ALTERNATIVES) {
      diagnostics.push(createRecommendationDiagnostic("recommendation-target-limit-reached", "info", "Target alternatives were truncated"));
    }
    diagnostics.push(createRecommendationDiagnostic("recommendation-target-ambiguous", "info", "Source target is ambiguous"));
    return { target: { status: "ambiguous", alternatives, ...logical }, diagnostics };
  }

  if (logical.route || logical.flow || logical.checkpoint) {
    diagnostics.push(createRecommendationDiagnostic("recommendation-target-unmapped", "info", "Using logical target context"));
    return { target: { status: "logical", ...logical }, diagnostics };
  }

  diagnostics.push(createRecommendationDiagnostic("recommendation-target-unmapped", "info", "No source file was selected"));
  return { target: { status: "unmapped", ...logical }, diagnostics };
}
