import type {
  ExistingSourceLocation,
  SourceMappingCandidate,
  SourceMappingDiagnostic,
  SourceMappingResult,
  SourceMappingSignal,
} from "@a11yst/types";
import { mergeDiagnostics, sortDiagnostics, dedupeCandidates } from "./compare.js";
import { validateConfidenceProvenance } from "./confidence-provenance.js";
import { flatToRegion, validateSourceLocation } from "./location.js";
import { sanitizeSignals } from "./signals.js";
import { SourceMappingValidationError } from "./errors.js";
import { createDiagnostic } from "./diagnostics.js";
import { omitUndefinedDeep } from "./serialize.js";

export type CreateCandidateInput = {
  uri: string;
  region: SourceMappingCandidate["location"]["region"];
  confidence: SourceMappingCandidate["confidence"];
  provenance: SourceMappingCandidate["provenance"];
  signals?: SourceMappingSignal[];
  symbol?: string;
  component?: string;
  language?: string;
  framework?: string;
  adapter?: string;
};

/**
 * Builds a validated source mapping candidate or throws SourceMappingValidationError.
 */
export function createSourceMappingCandidate(
  input: CreateCandidateInput,
): SourceMappingCandidate {
  validateConfidenceProvenance(input.confidence, input.provenance);

  const locationResult = validateSourceLocation({
    uri: input.uri,
    region: input.region,
    symbol: input.symbol,
    component: input.component,
    language: input.language,
  });

  if (!locationResult.ok) {
    throw new SourceMappingValidationError(
      `Invalid candidate location: ${locationResult.code}`,
      locationResult.code,
    );
  }

  const signalResult = sanitizeSignals(input.signals ?? []);
  const candidate: SourceMappingCandidate = {
    location: locationResult.location,
    confidence: input.confidence,
    provenance: input.provenance,
    signals: signalResult.signals,
  };

  if (input.framework !== undefined) {
    candidate.framework = input.framework;
  }
  if (input.adapter !== undefined) {
    candidate.adapter = input.adapter;
  }

  return candidate;
}

function hasInvalidatingErrors(diagnostics: SourceMappingDiagnostic[]): boolean {
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.level === "error" &&
      (diagnostic.code === "invalid-source-uri" ||
        diagnostic.code === "invalid-source-region" ||
        diagnostic.code === "unsafe-source-path"),
  );
}

function distinctLocationCount(candidates: SourceMappingCandidate[]): number {
  const keys = new Set(
    candidates.map(
      (candidate) =>
        `${candidate.location.uri}\0${candidate.location.region.start.line}\0${candidate.location.region.start.column ?? ""}`,
    ),
  );
  return keys.size;
}

/**
 * Creates a source mapping result from validated or raw candidates.
 */
export function createSourceMappingResult(
  candidates: SourceMappingCandidate[],
  diagnostics: SourceMappingDiagnostic[] = [],
): SourceMappingResult {
  const workingDiagnostics = [...diagnostics];
  const validCandidates: SourceMappingCandidate[] = [];

  for (const candidate of candidates) {
    try {
      validateConfidenceProvenance(candidate.confidence, candidate.provenance);
      const locationResult = validateSourceLocation({
        uri: candidate.location.uri,
        region: candidate.location.region,
        symbol: candidate.location.symbol,
        component: candidate.location.component,
        language: candidate.location.language,
      });

      if (!locationResult.ok) {
        workingDiagnostics.push(
          createDiagnostic(locationResult.code, "error", locationResult.code, candidate.location.uri),
        );
        continue;
      }

      const signalResult = sanitizeSignals(candidate.signals);
      for (const signalDiagnostic of signalResult.diagnostics) {
        workingDiagnostics.push({
          code: signalDiagnostic.code,
          level: signalDiagnostic.level,
          message: signalDiagnostic.message,
        });
      }

      const normalized: SourceMappingCandidate = {
        location: locationResult.location,
        confidence: candidate.confidence,
        provenance: candidate.provenance,
        signals: signalResult.signals,
      };
      if (candidate.framework !== undefined) {
        normalized.framework = candidate.framework;
      }
      if (candidate.adapter !== undefined) {
        normalized.adapter = candidate.adapter;
      }
      validCandidates.push(normalized);
    } catch (error) {
      if (error instanceof SourceMappingValidationError) {
        workingDiagnostics.push(
          createDiagnostic(
            error.code as SourceMappingDiagnostic["code"],
            "error",
            error.message,
          ),
        );
      } else {
        throw error;
      }
    }
  }

  const deduped = dedupeCandidates(validCandidates);
  if (deduped.duplicateDetected) {
    workingDiagnostics.push(
      createDiagnostic(
        "duplicate-candidate",
        "warning",
        "Duplicate source mapping candidates were merged",
      ),
    );
  }

  const sortedCandidates = deduped.candidates;
  const sortedDiagnostics = sortDiagnostics(workingDiagnostics);

  if (hasInvalidatingErrors(sortedDiagnostics)) {
    return omitUndefinedDeep({
      status: "invalid",
      candidates: [],
      diagnostics: sortedDiagnostics,
    }) as SourceMappingResult;
  }

  if (sortedCandidates.length === 0) {
    return omitUndefinedDeep({
      status: "unmapped",
      candidates: [],
      diagnostics: sortedDiagnostics,
    }) as SourceMappingResult;
  }

  if (sortedCandidates.length === 1) {
    const selected = sortedCandidates[0]!;
    return omitUndefinedDeep({
      status: "mapped",
      selected,
      candidates: sortedCandidates,
      diagnostics: sortedDiagnostics,
    }) as SourceMappingResult;
  }

  const exactCandidates = sortedCandidates.filter(
    (candidate) => candidate.confidence === "exact",
  );

  if (exactCandidates.length >= 2 && distinctLocationCount(exactCandidates) >= 2) {
    const conflictingDiagnostics = mergeDiagnostics(sortedDiagnostics, [
      createDiagnostic(
        "conflicting-exact-candidates",
        "warning",
        "Multiple exact candidates point to different locations",
      ),
      createDiagnostic(
        "ambiguous-candidates",
        "info",
        "No unambiguous source mapping candidate could be selected",
      ),
    ]);

    return omitUndefinedDeep({
      status: "ambiguous",
      candidates: sortedCandidates,
      diagnostics: conflictingDiagnostics,
    }) as SourceMappingResult;
  }

  if (exactCandidates.length === 1 && sortedCandidates.length > 1) {
    const selected = exactCandidates[0]!;
    return omitUndefinedDeep({
      status: "mapped",
      selected,
      candidates: sortedCandidates,
      diagnostics: sortedDiagnostics,
    }) as SourceMappingResult;
  }

  if (distinctLocationCount(sortedCandidates) >= 2) {
    const ambiguousDiagnostics = mergeDiagnostics(sortedDiagnostics, [
      createDiagnostic(
        "ambiguous-candidates",
        "info",
        "No unambiguous source mapping candidate could be selected",
      ),
    ]);

    return omitUndefinedDeep({
      status: "ambiguous",
      candidates: sortedCandidates,
      diagnostics: ambiguousDiagnostics,
    }) as SourceMappingResult;
  }

  const selected = sortedCandidates[0]!;
  return omitUndefinedDeep({
    status: "mapped",
    selected,
    candidates: sortedCandidates,
    diagnostics: sortedDiagnostics,
  }) as SourceMappingResult;
}

/**
 * Adapts an existing flat source location into a source mapping result.
 */
export function createMappingFromExistingSourceLocation(
  sourceLocation: ExistingSourceLocation | undefined,
): SourceMappingResult {
  if (sourceLocation === undefined) {
    return createSourceMappingResult([], [
      createDiagnostic(
        "missing-source-location",
        "info",
        "No existing source location was provided",
      ),
    ]);
  }

  const region = flatToRegion(sourceLocation);
  const locationResult = validateSourceLocation({
    uri: sourceLocation.uri,
    region,
  });

  if (!locationResult.ok) {
    return createSourceMappingResult([], [
      createDiagnostic(
        locationResult.code,
        "error",
        locationResult.code,
        sourceLocation.uri,
      ),
    ]);
  }

  const candidate: SourceMappingCandidate = {
    location: locationResult.location,
    confidence: "exact",
    provenance: "existing-source-location",
    signals: [
      {
        kind: "source-location-present",
        matched: true,
      },
    ],
  };

  return createSourceMappingResult([candidate]);
}
