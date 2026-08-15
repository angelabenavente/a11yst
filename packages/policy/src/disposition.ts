import type { FindingDisposition } from "@a11yst/types";

const POLICY_EXCLUDED_DISPOSITIONS = new Set<FindingDisposition>([
  "false-positive",
  "not-applicable",
]);

export function isPolicyExcludedDisposition(
  disposition: FindingDisposition | undefined,
): boolean {
  return disposition !== undefined && POLICY_EXCLUDED_DISPOSITIONS.has(disposition);
}
