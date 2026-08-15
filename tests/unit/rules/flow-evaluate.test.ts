import { describe, expect, it } from "vitest";
import { evaluateFlowRules } from "@a11yst/rules";
import type { FlowStepResult } from "@a11yst/types";

function clickStep(overrides: Partial<FlowStepResult> = {}): FlowStepResult {
  return {
    index: 0,
    action: "click",
    status: "completed",
    startedAt: new Date().toISOString(),
    durationMs: 10,
    diagnostics: [],
    target: ["body", "main", "button#open-bad"],
    observedChanges: {
      visibleDialogsBefore: [
        { target: ["div"], role: "dialog", visible: false },
      ],
      visibleDialogsAfter: [
        { target: ["div"], role: "dialog", visible: true },
      ],
      activeElementAfter: {
        target: ["button", "#open-bad"],
        role: "button",
        visible: true,
      },
    },
    ...overrides,
  };
}

describe("evaluateFlowRules", () => {
  it("detects dialog-focus-entry when focus stays on the opener", () => {
    const findings = evaluateFlowRules(
      { steps: [clickStep()] },
      {
        projectName: "demo",
        profile: "default",
        flowId: "dialog-bad",
        checkpointId: "dialog-open",
      },
    );

    expect(findings.some((finding) => finding.ruleId === "dialog-focus-entry")).toBe(true);
  });

  it("does not flag dialog-focus-entry when focus moves into the dialog", () => {
    const findings = evaluateFlowRules(
      {
        steps: [
          clickStep({
            target: ["button", "#open-accessible"],
            observedChanges: {
              visibleDialogsBefore: [
                { target: ["div"], role: "dialog", visible: false },
              ],
              visibleDialogsAfter: [
                { target: ["div"], role: "dialog", visible: true },
              ],
              activeElementAfter: {
                target: ["button", "#close-accessible"],
                role: "button",
                visible: true,
              },
            },
          }),
        ],
      },
      {
        projectName: "demo",
        profile: "default",
        flowId: "dialog-accessible",
        checkpointId: "dialog-open",
      },
    );

    expect(findings.some((finding) => finding.ruleId === "dialog-focus-entry")).toBe(false);
  });
});
