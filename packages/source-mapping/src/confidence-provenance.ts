import type {
  SourceMappingConfidence,
  SourceMappingProvenance,
} from "@a11yst/types";
import { SourceMappingValidationError } from "./errors.js";

const EXACT_FORBIDDEN: ReadonlySet<SourceMappingProvenance> = new Set([
  "selector-match",
  "text-match",
  "component-match",
  "user-provided",
]);

const EXACT_ALLOWED: ReadonlySet<SourceMappingProvenance> = new Set([
  "existing-source-location",
  "runtime-metadata",
  "source-map",
  "framework-compiler",
  "static-source-index",
]);

export const CONFIDENCE_ORDER: readonly SourceMappingConfidence[] = [
  "exact",
  "high",
  "medium",
  "low",
];

export const PROVENANCE_ORDER: readonly SourceMappingProvenance[] = [
  "existing-source-location",
  "runtime-metadata",
  "source-map",
  "framework-compiler",
  "static-source-index",
  "selector-match",
  "text-match",
  "component-match",
  "user-provided",
];

export function compareConfidence(
  left: SourceMappingConfidence,
  right: SourceMappingConfidence,
): number {
  return CONFIDENCE_ORDER.indexOf(left) - CONFIDENCE_ORDER.indexOf(right);
}

export function compareProvenance(
  left: SourceMappingProvenance,
  right: SourceMappingProvenance,
): number {
  return PROVENANCE_ORDER.indexOf(left) - PROVENANCE_ORDER.indexOf(right);
}

/**
 * Rejects impossible confidence and provenance combinations.
 */
export function validateConfidenceProvenance(
  confidence: SourceMappingConfidence,
  provenance: SourceMappingProvenance,
): void {
  if (confidence === "exact") {
    if (EXACT_FORBIDDEN.has(provenance)) {
      throw new SourceMappingValidationError(
        `provenance "${provenance}" cannot produce exact confidence`,
        "unsupported-provenance",
      );
    }
    if (!EXACT_ALLOWED.has(provenance)) {
      throw new SourceMappingValidationError(
        `provenance "${provenance}" is not allowed for exact confidence`,
        "unsupported-provenance",
      );
    }
  }
}

export function isExactAllowedProvenance(provenance: SourceMappingProvenance): boolean {
  return EXACT_ALLOWED.has(provenance);
}
