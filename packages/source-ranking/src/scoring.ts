import type {
  SourceMappingCandidate,
  SourceMappingConfidence,
  SourceMappingProvenance,
  SourceMappingSignal,
  SourceMappingSignalKind,
  SourceRankingContext,
  SourceRankingContribution,
} from "@a11yst/types";
import {
  compareConfidence,
  mergeSignals,
  sanitizeSignals,
  sortSignals,
} from "@a11yst/source-mapping";
import {
  BASE_CONFIDENCE_SCORE,
  CONTEXT_ADAPTER_MATCH,
  CONTEXT_ADAPTER_MISMATCH,
  CONTEXT_COMPONENT_MATCH,
  CONTEXT_COMPONENT_MISMATCH,
  CONTEXT_FRAMEWORK_MATCH,
  CONTEXT_FRAMEWORK_MISMATCH,
  CONTEXT_OWNER_MATCH,
  CONTEXT_OWNER_MISMATCH,
  CONTEXT_PREFERRED_URI_MATCH,
  CONTEXT_ROUTE_MATCH,
  CONTEXT_ROUTE_MISMATCH,
  CONTEXT_SCOPE_MATCH,
  CONTEXT_SCOPE_MISMATCH,
  CONTEXT_TAG_MATCH,
  CONTEXT_TAG_MISMATCH,
  CONTEXT_ONLY_SIGNAL_KINDS,
  NEGATIVE_SIGNAL_WEIGHTS,
  POSITIVE_SIGNAL_WEIGHTS,
  PROVENANCE_DIVERSITY_BONUS,
  SIGNAL_DIVERSITY_BONUS,
  STRONG_SIGNAL_KINDS,
} from "./constants.js";

export type ScoreComputation = {
  score: number;
  effectiveConfidence: SourceMappingConfidence;
  contributions: SourceRankingContribution[];
  positiveSignalKinds: Set<SourceMappingSignalKind>;
  strongPositiveKinds: Set<SourceMappingSignalKind>;
  hasCriticalConflict: boolean;
  hasOnlyContextEvidence: boolean;
  signalEvidenceScore: number;
  contextEvidenceScore: number;
  degradedConfidence: boolean;
};

function signalKey(signal: SourceMappingSignal): string {
  return `${signal.kind}\0${signal.matched}\0${signal.value ?? ""}`;
}

function contribution(
  code: SourceRankingContribution["code"],
  value: number,
  message: string,
): SourceRankingContribution {
  return { code, value, message };
}

function diversityBonus(count: number, table: readonly number[]): number {
  const index = Math.min(Math.max(count, 0), table.length - 1);
  return table[index] ?? 0;
}

function signalContributionCode(kind: SourceMappingSignalKind, matched: boolean): SourceRankingContribution["code"] {
  if (!matched) {
    return "unmatched-signal";
  }
  switch (kind) {
    case "selector":
      return "selector-evidence";
    case "component-name":
      return "component-evidence";
    case "accessible-name":
      return "accessible-name-evidence";
    case "attribute":
      return "attribute-evidence";
    case "visible-text":
      return "visible-text-evidence";
    case "element-tag":
      return "element-tag-evidence";
    case "route":
      return "route-evidence";
    case "framework-metadata":
      return "framework-evidence";
    default:
      return "independent-signal";
  }
}

function highestConfidence(candidates: SourceMappingCandidate[]): SourceMappingConfidence {
  let best: SourceMappingConfidence = "low";
  for (const candidate of candidates) {
    if (compareConfidence(candidate.confidence, best) < 0) {
      best = candidate.confidence;
    }
  }
  return best;
}

function mergeGroupSignals(
  candidates: SourceMappingCandidate[],
  maxSignals: number,
): { signals: SourceMappingSignal[]; truncated: boolean } {
  let merged: SourceMappingSignal[] = [];
  for (const candidate of candidates) {
    merged = mergeSignals(merged, candidate.signals);
  }
  const sanitized = sanitizeSignals(merged);
  const sorted = sortSignals(sanitized.signals);
  if (sorted.length <= maxSignals) {
    return { signals: sorted, truncated: false };
  }
  return { signals: sorted.slice(0, maxSignals), truncated: true };
}

function normalizeRoutePattern(value: string): string {
  return value.replace(/\/+$/, "") || "/";
}

export function computeGroupScore(input: {
  candidates: SourceMappingCandidate[];
  context: SourceRankingContext;
  maxSignalsPerCandidate: number;
}): ScoreComputation {
  const contributions: SourceRankingContribution[] = [];
  const baseConfidence = highestConfidence(input.candidates);
  let score = BASE_CONFIDENCE_SCORE[baseConfidence];
  contributions.push(contribution("base-confidence", BASE_CONFIDENCE_SCORE[baseConfidence], "Base confidence score applied."));

  if (baseConfidence === "exact") {
    contributions.push(contribution("exact-location", 0, "Exact location candidate."));
  }

  const { signals, truncated } = mergeGroupSignals(input.candidates, input.maxSignalsPerCandidate);
  const seenSignals = new Set<string>();
  const positiveSignalKinds = new Set<SourceMappingSignalKind>();
  const strongPositiveKinds = new Set<SourceMappingSignalKind>();
  const unmatchedStrongKinds = new Set<SourceMappingSignalKind>();
  let signalEvidenceScore = 0;
  let hasCriticalConflict = false;

  for (const signal of signals) {
    const key = signalKey(signal);
    if (seenSignals.has(key)) {
      continue;
    }
    seenSignals.add(key);

    const weightTable = signal.matched ? POSITIVE_SIGNAL_WEIGHTS : NEGATIVE_SIGNAL_WEIGHTS;
    const weight = weightTable[signal.kind];
    if (weight === undefined) {
      continue;
    }

    score += weight;
    signalEvidenceScore += weight;
    contributions.push(contribution(signalContributionCode(signal.kind, signal.matched), weight, signal.matched
      ? `Matched ${signal.kind} evidence.`
      : `Unmatched ${signal.kind} evidence.`));

    if (signal.matched) {
      positiveSignalKinds.add(signal.kind);
      if (STRONG_SIGNAL_KINDS.has(signal.kind)) {
        strongPositiveKinds.add(signal.kind);
      }
    } else if (STRONG_SIGNAL_KINDS.has(signal.kind)) {
      unmatchedStrongKinds.add(signal.kind);
    }
  }

  for (const kind of unmatchedStrongKinds) {
    if (strongPositiveKinds.has(kind)) {
      hasCriticalConflict = true;
      contributions.push(contribution("conflicting-signal", 0, `Conflicting ${kind} evidence.`));
    }
  }

  const positiveKindCount = positiveSignalKinds.size;
  const signalDiversityBonus = diversityBonus(positiveKindCount, SIGNAL_DIVERSITY_BONUS);
  if (signalDiversityBonus > 0) {
    score += signalDiversityBonus;
    signalEvidenceScore += signalDiversityBonus;
    contributions.push(contribution("independent-signal", signalDiversityBonus, "Independent signal diversity bonus."));
  }

  const provenances = new Set<SourceMappingProvenance>();
  for (const candidate of input.candidates) {
    provenances.add(candidate.provenance);
  }
  const provenanceBonus = diversityBonus(provenances.size, PROVENANCE_DIVERSITY_BONUS);
  if (provenanceBonus > 0) {
    score += provenanceBonus;
    signalEvidenceScore += provenanceBonus;
    contributions.push(contribution("independent-provenance", provenanceBonus, "Independent provenance diversity bonus."));
  }

  let contextEvidenceScore = 0;
  const representative = input.candidates[0]!;

  if (input.context.expectedFramework) {
    const matches = representative.framework === input.context.expectedFramework;
    const value = matches ? CONTEXT_FRAMEWORK_MATCH : CONTEXT_FRAMEWORK_MISMATCH;
    score += value;
    contextEvidenceScore += value;
    contributions.push(contribution("framework-evidence", value, matches ? "Framework context matched." : "Framework context mismatched."));
    if (!matches && baseConfidence !== "exact") {
      hasCriticalConflict = true;
    }
  }

  if (input.context.expectedAdapter) {
    const matches = representative.adapter === input.context.expectedAdapter;
    const value = matches ? CONTEXT_ADAPTER_MATCH : CONTEXT_ADAPTER_MISMATCH;
    score += value;
    contextEvidenceScore += value;
    contributions.push(contribution("adapter-evidence", value, matches ? "Adapter context matched." : "Adapter context mismatched."));
  }

  if (input.context.scopeIds && input.context.scopeIds.length > 0) {
    const scopeSignal = signals.find((signal) => signal.kind === "framework-metadata" && signal.matched && signal.value);
    if (scopeSignal?.value) {
      const inScope = input.context.scopeIds.includes(scopeSignal.value);
      const value = inScope ? CONTEXT_SCOPE_MATCH : CONTEXT_SCOPE_MISMATCH;
      score += value;
      contextEvidenceScore += value;
      contributions.push(contribution("scope-evidence", value, inScope ? "Scope context matched." : "Scope context mismatched."));
      if (!inScope && baseConfidence !== "exact") {
        hasCriticalConflict = true;
      }
    }
  }

  if (input.context.routePattern) {
    const routeSignal = signals.find((signal) => signal.kind === "route" && signal.matched);
    const normalizedExpected = normalizeRoutePattern(input.context.routePattern);
    const normalizedActual = routeSignal?.value ? normalizeRoutePattern(routeSignal.value) : undefined;
    const matches = normalizedActual !== undefined && normalizedActual === normalizedExpected;
    const value = matches ? CONTEXT_ROUTE_MATCH : normalizedActual !== undefined ? CONTEXT_ROUTE_MISMATCH : 0;
    if (value !== 0) {
      score += value;
      contextEvidenceScore += value;
      contributions.push(contribution("route-evidence", value, matches ? "Route context matched." : "Route context mismatched."));
    }
  }

  if (input.context.componentName) {
    const matches = representative.location.component === input.context.componentName
      || representative.location.symbol === input.context.componentName;
    const value = matches ? CONTEXT_COMPONENT_MATCH : CONTEXT_COMPONENT_MISMATCH;
    score += value;
    contextEvidenceScore += value;
    contributions.push(contribution("component-evidence", value, matches ? "Component context matched." : "Component context mismatched."));
    if (!matches && baseConfidence !== "exact") {
      hasCriticalConflict = true;
    }
  }

  if (input.context.ownerComponent) {
    const matches = representative.location.component === input.context.ownerComponent;
    const value = matches ? CONTEXT_OWNER_MATCH : CONTEXT_OWNER_MISMATCH;
    score += value;
    contextEvidenceScore += value;
    contributions.push(contribution("component-evidence", value, matches ? "Owner component context matched." : "Owner component context mismatched."));
    if (!matches && baseConfidence !== "exact") {
      hasCriticalConflict = true;
    }
  }

  if (input.context.elementTag) {
    const tagSignal = signals.find((signal) => signal.kind === "element-tag");
    const matches = tagSignal?.matched === true && tagSignal.value?.toLowerCase() === input.context.elementTag;
    const value = matches ? CONTEXT_TAG_MATCH : tagSignal?.matched === false ? CONTEXT_TAG_MISMATCH : 0;
    if (value !== 0) {
      score += value;
      contextEvidenceScore += value;
      contributions.push(contribution("element-tag-evidence", value, matches ? "Element tag context matched." : "Element tag context mismatched."));
      if (!matches) {
        hasCriticalConflict = true;
      }
    }
  }

  if (input.context.preferredUris && input.context.preferredUris.length > 0) {
    const matches = input.context.preferredUris.includes(representative.location.uri);
    if (matches) {
      score += CONTEXT_PREFERRED_URI_MATCH;
      contextEvidenceScore += CONTEXT_PREFERRED_URI_MATCH;
      contributions.push(contribution("preferred-uri", CONTEXT_PREFERRED_URI_MATCH, "Preferred URI matched."));
    }
  }

  if (baseConfidence === "low") {
    contributions.push(contribution("low-confidence", 0, "Low confidence candidate."));
  }

  if (!Number.isFinite(score)) {
    score = 0;
  }
  score = Math.max(0, Math.trunc(score));

  let effectiveConfidence = baseConfidence;
  let degradedConfidence = false;

  if (baseConfidence === "high" && (hasCriticalConflict || unmatchedStrongKinds.size > 0)) {
    effectiveConfidence = "medium";
    degradedConfidence = true;
    contributions.push(contribution("conflicting-signal", 0, "High confidence degraded due to conflicts."));
  }

  if (baseConfidence === "medium" && (positiveKindCount < 2 || strongPositiveKinds.size === 0 || hasCriticalConflict)) {
    effectiveConfidence = "low";
    degradedConfidence = true;
    contributions.push(contribution("insufficient-evidence", 0, "Medium confidence degraded due to insufficient evidence."));
  }

  const onlyContextKinds = positiveKindCount > 0
    && [...positiveSignalKinds].every((kind) => CONTEXT_ONLY_SIGNAL_KINDS.has(kind));
  const hasOnlyContextEvidence = signalEvidenceScore <= 0 && contextEvidenceScore > 0
    || (signalEvidenceScore > 0 && onlyContextKinds && strongPositiveKinds.size === 0);

  if (truncated) {
    contributions.push(contribution("insufficient-evidence", 0, "Signal evidence was truncated."));
  }

  return {
    score,
    effectiveConfidence,
    contributions,
    positiveSignalKinds,
    strongPositiveKinds,
    hasCriticalConflict,
    hasOnlyContextEvidence,
    signalEvidenceScore,
    contextEvidenceScore,
    degradedConfidence,
  };
}

export function compareContributions(
  left: SourceRankingContribution,
  right: SourceRankingContribution,
): number {
  const codeOrder = left.code.localeCompare(right.code);
  if (codeOrder !== 0) {
    return codeOrder;
  }
  if (left.value !== right.value) {
    return left.value - right.value;
  }
  return left.message.localeCompare(right.message);
}

export function sortContributions(contributions: SourceRankingContribution[]): SourceRankingContribution[] {
  return [...contributions].sort(compareContributions);
}
