import type { ResolvedCiPolicyConfig, Severity } from "@a11yst/types";
import { DEFAULT_CI_POLICY } from "@a11yst/types";
import { SEVERITY_ORDER } from "./severity.js";

/** Explicit CLI overrides for CI policy flags (undefined = not overridden). */
export type CiPolicyCliOverrides = {
  failOnNew?: boolean;
  failOnRegression?: boolean;
  failOnExpiredClassification?: boolean;
  minimumSeverity?: Severity;
};

export function isValidMinimumSeverity(value: string): value is Severity {
  return (SEVERITY_ORDER as readonly string[]).includes(value);
}

/**
 * Merge config CI policy with explicit CLI overrides.
 * CLI values take precedence; absent CLI keys inherit from config.
 */
export function resolveCiPolicyConfig(input: {
  configPolicy: ResolvedCiPolicyConfig;
  cliOverrides?: CiPolicyCliOverrides;
}): ResolvedCiPolicyConfig {
  const base = input.configPolicy;
  const cli = input.cliOverrides ?? {};

  return {
    failOnNew: cli.failOnNew ?? base.failOnNew ?? DEFAULT_CI_POLICY.failOnNew,
    failOnRegression:
      cli.failOnRegression ??
      base.failOnRegression ??
      DEFAULT_CI_POLICY.failOnRegression,
    failOnExpiredClassification:
      cli.failOnExpiredClassification ??
      base.failOnExpiredClassification ??
      DEFAULT_CI_POLICY.failOnExpiredClassification,
    minimumSeverity:
      cli.minimumSeverity ?? base.minimumSeverity ?? DEFAULT_CI_POLICY.minimumSeverity,
  };
}
