import type { ProfileFinding, ProfileSnapshot } from "@a11yst/types";
import {
  hasSignificantHorizontalOverflow,
  intersects,
  overlapPercent,
  type Rect,
} from "../geometry.js";
import { buildA11ystFinding, type RuleEvaluationContext } from "../types.js";
import { LARGE_TEXT_RULES } from "../registry.js";

export interface LayoutElementSnapshot {
  target: string[];
  boundingBox?: Rect;
  visible: boolean;
  text?: string;
  tag: string;
  overflowX?: string;
  overflowY?: string;
  scrollWidth?: number;
  clientWidth?: number;
  scrollHeight?: number;
  clientHeight?: number;
}

export interface LayoutComparisonInput {
  baseline?: ProfileSnapshot;
  scaled: ProfileSnapshot;
  elements: LayoutElementSnapshot[];
  scaledElements: LayoutElementSnapshot[];
  tolerancePx: number;
  overlapTolerancePercent: number;
}

function ruleMeta(id: string) {
  const meta = LARGE_TEXT_RULES.find((rule) => rule.id === id);
  if (!meta) throw new Error(`Unknown large-text rule: ${id}`);
  return meta;
}

export function evaluateLargeTextRules(
  input: LayoutComparisonInput,
  context: RuleEvaluationContext,
): ProfileFinding[] {
  const findings: ProfileFinding[] = [];
  const baseline = input.baseline;

  if (
    baseline &&
    hasSignificantHorizontalOverflow(
      input.scaled.scrollWidth ?? 0,
      input.scaled.clientWidth ?? 0,
      input.tolerancePx,
    ) &&
    !hasSignificantHorizontalOverflow(
      baseline.scrollWidth ?? 0,
      baseline.clientWidth ?? 0,
      input.tolerancePx,
    )
  ) {
    findings.push(
      buildA11ystFinding(
        {
          ruleId: "large-text-horizontal-overflow",
          title: ruleMeta("large-text-horizontal-overflow").title,
          target: ["html"],
          comparison: {
            baselineProfile: "default",
            currentProfile: "large-text",
            before: {
              scrollWidth: baseline.scrollWidth,
              clientWidth: baseline.clientWidth,
            },
            after: {
              scrollWidth: input.scaled.scrollWidth,
              clientWidth: input.scaled.clientWidth,
            },
          },
        },
        context,
        ruleMeta("large-text-horizontal-overflow"),
      ),
    );
  }

  const baselineByTarget = new Map(
    input.elements.map((element) => [element.target.join("|"), element]),
  );

  for (const scaled of input.scaledElements) {
    const key = scaled.target.join("|");
    const base = baselineByTarget.get(key);
    if (!base) continue;

    if (base.visible && !scaled.visible && (base.text?.length ?? 0) > 0) {
      findings.push(
        buildA11ystFinding(
          {
            ruleId: "large-text-content-hidden",
            title: ruleMeta("large-text-content-hidden").title,
            target: scaled.target,
            comparison: {
              baselineProfile: "default",
              currentProfile: "large-text",
              before: { visible: true },
              after: { visible: false },
            },
          },
          context,
          ruleMeta("large-text-content-hidden"),
        ),
      );
    }

    if (
      base.boundingBox &&
      scaled.boundingBox &&
      !intersects(base.boundingBox, scaled.boundingBox) &&
      overlapPercent(base.boundingBox, scaled.boundingBox) < input.overlapTolerancePercent
    ) {
      for (const other of input.scaledElements) {
        if (other.target.join("|") === key || !other.boundingBox || !scaled.boundingBox) continue;
        if (overlapPercent(scaled.boundingBox, other.boundingBox) >= input.overlapTolerancePercent) {
          const baseOther = baselineByTarget.get(other.target.join("|"));
          if (
            baseOther?.boundingBox &&
            overlapPercent(baseOther.boundingBox, other.boundingBox) < input.overlapTolerancePercent
          ) {
            findings.push(
              buildA11ystFinding(
                {
                  ruleId: "large-text-overlap",
                  title: ruleMeta("large-text-overlap").title,
                  target: scaled.target,
                  comparison: {
                    baselineProfile: "default",
                    currentProfile: "large-text",
                  },
                },
                context,
                ruleMeta("large-text-overlap"),
              ),
            );
          }
        }
      }
    }

    if (
      scaled.visible &&
      (scaled.overflowY === "hidden" || scaled.overflowY === "clip") &&
      (scaled.scrollHeight ?? 0) - (scaled.clientHeight ?? 0) > input.tolerancePx &&
      (base.scrollHeight ?? 0) - (base.clientHeight ?? 0) <= input.tolerancePx
    ) {
      findings.push(
        buildA11ystFinding(
          {
            ruleId: "large-text-clipped-content",
            title: ruleMeta("large-text-clipped-content").title,
            target: scaled.target,
          },
          context,
          ruleMeta("large-text-clipped-content"),
        ),
      );
    }

    const controlTags = new Set(["button", "input", "select", "textarea", "a"]);
    if (
      controlTags.has(scaled.tag.toLowerCase()) &&
      scaled.text &&
      scaled.boundingBox &&
      scaled.clientWidth &&
      scaled.scrollWidth &&
      scaled.scrollWidth - scaled.clientWidth > input.tolerancePx
    ) {
      findings.push(
        buildA11ystFinding(
          {
            ruleId: "large-text-control-truncation",
            title: ruleMeta("large-text-control-truncation").title,
            target: scaled.target,
          },
          context,
          ruleMeta("large-text-control-truncation"),
        ),
      );
    }

    if (
      (scaled.overflowX === "hidden" || scaled.overflowY === "hidden") &&
      scaled.clientHeight &&
      scaled.clientWidth &&
      scaled.clientHeight <= 48 &&
      scaled.text &&
      scaled.text.length > 24
    ) {
      findings.push(
        buildA11ystFinding(
          {
            ruleId: "large-text-fixed-dimension-risk",
            title: ruleMeta("large-text-fixed-dimension-risk").title,
            target: scaled.target,
          },
          context,
          ruleMeta("large-text-fixed-dimension-risk"),
        ),
      );
    }
  }

  return findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}
