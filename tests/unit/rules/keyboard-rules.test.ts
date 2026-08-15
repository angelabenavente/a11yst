import { describe, expect, it } from "vitest";
import {
  evaluateKeyboardRules,
  type KeyboardTraversalResult,
  type RuleEvaluationContext,
} from "@a11yst/rules";

const context: RuleEvaluationContext = {
  projectName: "fixture",
  profile: "keyboard",
  route: "/issues",
  url: "http://127.0.0.1:6211/issues",
  viewport: "desktop",
};

const baseTraversal: KeyboardTraversalResult = {
  forwardSteps: [],
  backwardSteps: [],
  stopReason: "end-of-document",
  positiveTabIndexes: [],
  inventory: [],
};

describe("evaluateKeyboardRules", () => {
  it("reports positive tabindex values", () => {
    const findings = evaluateKeyboardRules(
      {
        ...baseTraversal,
        positiveTabIndexes: [
          {
            target: ["a[tabindex='1']"],
            tag: "a",
            disabled: false,
            visible: true,
            tabindex: 1,
          },
        ],
      },
      context,
      { maxTabStops: 100, detectFocusTraps: true },
    );

    expect(findings.map((finding) => finding.ruleId)).toContain("keyboard-positive-tabindex");
  });

  it("reports focus lost when traversal stops unexpectedly", () => {
    const findings = evaluateKeyboardRules(
      {
        ...baseTraversal,
        stopReason: "focus-lost",
        forwardSteps: [{ index: 0, direction: "forward", target: ["button"], visible: true, inViewport: true }],
      },
      context,
      { maxTabStops: 100, detectFocusTraps: true },
    );

    expect(findings.map((finding) => finding.ruleId)).toContain("keyboard-focus-lost");
  });

  it("reports focus cycles when trap detection is enabled", () => {
    const findings = evaluateKeyboardRules(
      {
        ...baseTraversal,
        stopReason: "cycle-detected",
        forwardSteps: [
          { index: 0, direction: "forward", target: ["#trap-a"], visible: true, inViewport: true },
          { index: 1, direction: "forward", target: ["#trap-b"], visible: true, inViewport: true },
          { index: 2, direction: "forward", target: ["#trap-a"], visible: true, inViewport: true },
        ],
      },
      context,
      { maxTabStops: 100, detectFocusTraps: true },
    );

    expect(findings.map((finding) => finding.ruleId)).toContain("keyboard-focus-cycle");
  });

  it("does not report focus cycles when trap detection is disabled", () => {
    const findings = evaluateKeyboardRules(
      {
        ...baseTraversal,
        stopReason: "cycle-detected",
        forwardSteps: [
          { index: 0, direction: "forward", target: ["#trap-a"], visible: true, inViewport: true },
          { index: 1, direction: "forward", target: ["#trap-b"], visible: true, inViewport: true },
          { index: 2, direction: "forward", target: ["#trap-a"], visible: true, inViewport: true },
        ],
      },
      context,
      { maxTabStops: 100, detectFocusTraps: false },
    );

    expect(findings.map((finding) => finding.ruleId)).not.toContain("keyboard-focus-cycle");
  });
});
