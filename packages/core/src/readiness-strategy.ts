import type { ReadinessStrategy } from "@a11yst/adapters";
import type { ResolvedReadinessConfig } from "@a11yst/types";

/**
 * Human-readable summary of the readiness settings applied to a planned run.
 */
export function describeReadinessStrategy(
  config: ResolvedReadinessConfig,
  strategy?: ReadinessStrategy,
): string {
  const parts: string[] = [];
  const waitUntil = config.waitUntil ?? strategy?.waitUntil ?? "domcontentloaded";
  parts.push(`waitUntil=${waitUntil}`);

  if (config.selector) {
    parts.push(`selector=${config.selector} (required)`);
  } else if (strategy?.selectors && strategy.selectors.length > 0) {
    parts.push(`recommended=${strategy.selectors.join("|")}`);
  }

  const timeout = config.timeout ?? strategy?.timeout;
  if (timeout !== undefined) {
    parts.push(`timeout=${timeout}ms`);
  }

  const settleFrames = config.settleFrames ?? strategy?.settleFrames;
  if (settleFrames !== undefined && settleFrames > 0) {
    parts.push(`settleFrames=${settleFrames}`);
  }

  return parts.join("; ");
}
