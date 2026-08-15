import type { PolicyEvaluationResult } from "@a11yst/types";
import type { SarifRun } from "./types.js";

export function buildRunProperties(options: {
  policyEvaluation?: PolicyEvaluationResult;
  resolvedFindingsCount?: number;
  includeResolvedSummary?: boolean;
}): Record<string, unknown> | undefined {
  const properties: Record<string, unknown> = {};

  if (options.policyEvaluation) {
    properties["a11yst.policy"] = {
      status: options.policyEvaluation.status,
      policyEnabled: options.policyEvaluation.policyEnabled,
      totalBreaches: options.policyEvaluation.summary.totalBreaches,
    };
  }

  if (options.includeResolvedSummary && options.resolvedFindingsCount !== undefined) {
    properties["a11yst.resolvedFindings"] = options.resolvedFindingsCount;
  }

  return Object.keys(properties).length > 0 ? properties : undefined;
}

export function attachRunProperties(run: SarifRun, properties: Record<string, unknown>): SarifRun {
  return {
    ...run,
    properties: {
      ...(run.properties ?? {}),
      ...properties,
    },
  };
}
