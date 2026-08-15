import type { Severity } from "./enums.js";

/**
 * Raw axe-core impact values. These are provider terminology — not a11yst
 * canonical severity.
 */
export type AxeImpact = "minor" | "moderate" | "serious" | "critical";

/** Canonical severity ordering from lowest to highest. */
export const SEVERITY_ORDER: readonly Severity[] = [
  "minor",
  "medium",
  "high",
  "critical",
] as const;

export const AXE_IMPACT_TO_SEVERITY: Readonly<Record<AxeImpact, Severity>> = {
  minor: "minor",
  moderate: "medium",
  serious: "high",
  critical: "critical",
};

/** Default when axe-core omits or reports an unknown impact. */
export const DEFAULT_UNKNOWN_AXE_SEVERITY: Severity = "medium";

export function isAxeImpact(value: string): value is AxeImpact {
  return value in AXE_IMPACT_TO_SEVERITY;
}

export function normalizeAxeImpact(
  impact: string | null | undefined,
): AxeImpact | null {
  if (typeof impact === "string" && isAxeImpact(impact)) {
    return impact;
  }
  return null;
}

/**
 * Map axe-core `impact` to canonical a11yst `Severity`.
 * Unknown/null impact defaults to {@link DEFAULT_UNKNOWN_AXE_SEVERITY}.
 */
export function mapAxeImpactToSeverity(
  impact: string | null | undefined,
): Severity {
  const normalized = normalizeAxeImpact(impact);
  if (normalized) {
    return AXE_IMPACT_TO_SEVERITY[normalized];
  }
  return DEFAULT_UNKNOWN_AXE_SEVERITY;
}

export function isKnownAxeImpact(impact: string | null | undefined): boolean {
  return normalizeAxeImpact(impact) !== null;
}

export function severityRank(severity: Severity): number {
  const index = SEVERITY_ORDER.indexOf(severity);
  return index === -1 ? -1 : index;
}

export function compareSeverity(a: Severity, b: Severity): number {
  return severityRank(a) - severityRank(b);
}

export function compareSeverityDescending(a: Severity, b: Severity): number {
  return severityRank(b) - severityRank(a);
}

export function isSeverityAtLeast(
  severity: Severity,
  minimumSeverity: Severity,
): boolean {
  return severityRank(severity) >= severityRank(minimumSeverity);
}

export function severityIncreased(
  previous: Severity,
  current: Severity,
): boolean {
  return compareSeverity(current, previous) > 0;
}

export function severityDecreased(
  previous: Severity,
  current: Severity,
): boolean {
  return compareSeverity(current, previous) < 0;
}

/** User-facing label: HIGH, not SERIOUS. */
export function formatSeverityLabel(severity: Severity): string {
  return severity.toUpperCase();
}

export function isSeverity(value: string): value is Severity {
  return (SEVERITY_ORDER as readonly string[]).includes(value);
}
