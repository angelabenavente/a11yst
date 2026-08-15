import type { MotionRecord, ProfileFinding, ProfileSnapshot } from "@a11yst/types";
import { buildA11ystFinding, type RuleEvaluationContext } from "../types.js";
import { REDUCED_MOTION_RULES } from "../registry.js";

function ruleMeta(id: string) {
  const meta = REDUCED_MOTION_RULES.find((rule) => rule.id === id);
  if (!meta) throw new Error(`Unknown reduced-motion rule: ${id}`);
  return meta;
}

export function isSignificantMotion(
  record: MotionRecord,
  minimumDurationMs: number,
): boolean {
  if (record.iterations === "infinite") return true;
  const duration = record.durationMs ?? 0;
  if (duration >= minimumDurationMs) return true;
  const props = record.properties ?? [];
  if (props.some((prop) => prop.includes("transform"))) {
    return duration >= minimumDurationMs / 2;
  }
  return false;
}

export function isBriefFade(record: MotionRecord): boolean {
  const props = record.properties ?? [];
  return (
    props.length > 0 &&
    props.every((prop) => prop.includes("opacity")) &&
    (record.durationMs ?? 0) <= 150
  );
}

export interface ReducedMotionEvaluationInput {
  matchMediaReduce: boolean;
  reducedRecords: MotionRecord[];
  baselineRecords?: MotionRecord[];
  smoothScrollDetected: boolean;
  minimumSignificantDurationMs: number;
}

export function evaluateReducedMotionRules(
  input: ReducedMotionEvaluationInput,
  context: RuleEvaluationContext,
): ProfileFinding[] {
  const findings: ProfileFinding[] = [];

  if (!input.matchMediaReduce) {
    findings.push(
      buildA11ystFinding(
        {
          ruleId: "reduced-motion-preference-not-applied",
          title: ruleMeta("reduced-motion-preference-not-applied").title,
          target: ["html"],
        },
        context,
        ruleMeta("reduced-motion-preference-not-applied"),
      ),
    );
  }

  for (const record of input.reducedRecords) {
    if (isBriefFade(record)) continue;
    if (!isSignificantMotion(record, input.minimumSignificantDurationMs)) continue;

    if (record.iterations === "infinite") {
      findings.push(
        buildA11ystFinding(
          {
            ruleId: "reduced-motion-infinite-animation",
            title: ruleMeta("reduced-motion-infinite-animation").title,
            target: record.target,
            comparison: {
              baselineProfile: "default",
              currentProfile: "reduced-motion",
              after: { animationName: record.animationName, iterations: record.iterations },
            },
          },
          context,
          ruleMeta("reduced-motion-infinite-animation"),
        ),
      );
      continue;
    }

    const baseline = input.baselineRecords?.find(
      (candidate) => candidate.target.join("|") === record.target.join("|"),
    );
    if (
      baseline &&
      baseline.durationMs === record.durationMs &&
      baseline.iterations === record.iterations &&
      JSON.stringify(baseline.properties ?? []) === JSON.stringify(record.properties ?? [])
    ) {
      findings.push(
        buildA11ystFinding(
          {
            ruleId: "reduced-motion-motion-unchanged",
            title: ruleMeta("reduced-motion-motion-unchanged").title,
            target: record.target,
            comparison: {
              baselineProfile: "default",
              currentProfile: "reduced-motion",
              before: { durationMs: baseline.durationMs, properties: baseline.properties },
              after: { durationMs: record.durationMs, properties: record.properties },
            },
          },
          context,
          ruleMeta("reduced-motion-motion-unchanged"),
        ),
      );
      continue;
    }

    if ((record.durationMs ?? 0) >= input.minimumSignificantDurationMs) {
      findings.push(
        buildA11ystFinding(
          {
            ruleId: "reduced-motion-long-animation",
            title: ruleMeta("reduced-motion-long-animation").title,
            target: record.target,
          },
          context,
          ruleMeta("reduced-motion-long-animation"),
        ),
      );
      continue;
    }

    findings.push(
      buildA11ystFinding(
        {
          ruleId: "reduced-motion-review",
          title: ruleMeta("reduced-motion-review").title,
          target: record.target,
        },
        context,
        ruleMeta("reduced-motion-review"),
      ),
    );
  }

  if (input.smoothScrollDetected) {
    findings.push(
      buildA11ystFinding(
        {
          ruleId: "reduced-motion-scroll-behavior",
          title: ruleMeta("reduced-motion-scroll-behavior").title,
          target: ["html"],
        },
        context,
        ruleMeta("reduced-motion-scroll-behavior"),
      ),
    );
  }

  return findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

export function collectMotionRecordsFromSnapshot(snapshot?: ProfileSnapshot): MotionRecord[] {
  return snapshot?.motionRecords ?? [];
}
