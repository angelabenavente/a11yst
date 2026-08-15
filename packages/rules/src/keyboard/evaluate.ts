import type { FocusStep, ProfileFinding } from "@a11yst/types";
import { buildA11ystFinding, type RuleEvaluationContext } from "../types.js";
import { KEYBOARD_RULES } from "../registry.js";

export interface InteractiveInventoryItem {
  target: string[];
  tag: string;
  role?: string;
  accessibleName?: string;
  tabindex?: number;
  disabled: boolean;
  visible: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface KeyboardTraversalResult {
  forwardSteps: FocusStep[];
  backwardSteps: FocusStep[];
  stopReason: string;
  positiveTabIndexes: InteractiveInventoryItem[];
  inventory: InteractiveInventoryItem[];
}

function ruleMeta(id: string) {
  const meta = KEYBOARD_RULES.find((rule) => rule.id === id);
  if (!meta) throw new Error(`Unknown keyboard rule: ${id}`);
  return meta;
}

function normalizeTargetKey(target: string[] | undefined): string {
  return (target ?? []).join("|") || "document";
}

export function evaluateKeyboardRules(
  traversal: KeyboardTraversalResult,
  context: RuleEvaluationContext,
  options: { maxTabStops: number; detectFocusTraps: boolean },
): ProfileFinding[] {
  const findings: ProfileFinding[] = [];

  for (const item of traversal.positiveTabIndexes) {
    findings.push(
      buildA11ystFinding(
        {
          ruleId: "keyboard-positive-tabindex",
          title: ruleMeta("keyboard-positive-tabindex").title,
          target: item.target,
        },
        context,
        ruleMeta("keyboard-positive-tabindex"),
      ),
    );
  }

  if (traversal.stopReason === "focus-lost") {
    findings.push(
      buildA11ystFinding(
        {
          ruleId: "keyboard-focus-lost",
          title: ruleMeta("keyboard-focus-lost").title,
          target: traversal.forwardSteps.at(-1)?.target ?? ["document"],
        },
        context,
        ruleMeta("keyboard-focus-lost"),
      ),
    );
  }

  if (traversal.stopReason === "limit-reached") {
    findings.push(
      buildA11ystFinding(
        {
          ruleId: "keyboard-excessive-tab-stops",
          title: ruleMeta("keyboard-excessive-tab-stops").title,
          description: `Tab traversal reached the configured limit of ${options.maxTabStops} stops.`,
          target: traversal.forwardSteps.at(-1)?.target ?? ["document"],
        },
        context,
        ruleMeta("keyboard-excessive-tab-stops"),
      ),
    );
  }

  if (options.detectFocusTraps && traversal.stopReason === "cycle-detected") {
    const cycleTargets = detectCycleTargets(traversal.forwardSteps);
    findings.push(
      buildA11ystFinding(
        {
          ruleId: "keyboard-focus-cycle",
          title: ruleMeta("keyboard-focus-cycle").title,
          target: cycleTargets,
        },
        context,
        ruleMeta("keyboard-focus-cycle"),
      ),
    );
  }

  for (const step of traversal.forwardSteps) {
    if (!step.visible || (step.boundingBox && step.boundingBox.width === 0)) {
      if (step.target && step.target.length > 0) {
        findings.push(
          buildA11ystFinding(
            {
              ruleId: "keyboard-focus-hidden",
              title: ruleMeta("keyboard-focus-hidden").title,
              target: step.target,
            },
            context,
            ruleMeta("keyboard-focus-hidden"),
          ),
        );
      }
    } else if (!step.inViewport && step.target) {
      findings.push(
        buildA11ystFinding(
          {
            ruleId: "keyboard-focus-offscreen",
            title: ruleMeta("keyboard-focus-offscreen").title,
            target: step.target,
          },
          context,
          ruleMeta("keyboard-focus-offscreen"),
        ),
      );
    }
  }

  const reached = new Set(traversal.forwardSteps.map((step) => normalizeTargetKey(step.target)));
  for (const item of traversal.inventory) {
    if (!item.visible || item.disabled) continue;
    const nativeTags = new Set(["button", "a", "input", "select", "textarea"]);
    if (!nativeTags.has(item.tag.toLowerCase())) continue;
    if (!reached.has(normalizeTargetKey(item.target))) {
      findings.push(
        buildA11ystFinding(
          {
            ruleId: "keyboard-unreachable-native-control",
            title: ruleMeta("keyboard-unreachable-native-control").title,
            target: item.target,
          },
          context,
          ruleMeta("keyboard-unreachable-native-control"),
        ),
      );
    }
  }

  return dedupeFindings(findings);
}

export function detectCycleTargets(steps: FocusStep[]): string[] {
  const keys = steps.map((step) => normalizeTargetKey(step.target));
  const seen = new Map<string, number>();
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index] ?? "";
    const previous = seen.get(key);
    if (previous !== undefined && index - previous >= 2) {
      return steps.slice(previous, index + 1).flatMap((step) => step.target ?? []);
    }
    seen.set(key, index);
  }
  return steps.at(-1)?.target ?? ["document"];
}

export function dedupeFindings(findings: ProfileFinding[]): ProfileFinding[] {
  const map = new Map<string, ProfileFinding>();
  for (const finding of findings) {
    map.set(finding.fingerprint, finding);
  }
  return [...map.values()].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}
