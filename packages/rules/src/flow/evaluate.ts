import type { ElementSummary, FlowStepResult } from "@a11yst/types";
import type { RuleEvaluationContext, RuleFindingInput } from "../types.js";

export interface FlowRuleEvaluationInput {
  steps: FlowStepResult[];
}

function visibleDialogCount(dialogs?: ElementSummary[]): number {
  return dialogs?.filter((dialog) => dialog.visible).length ?? 0;
}

function dialogOpened(step: FlowStepResult): boolean {
  const before = visibleDialogCount(step.observedChanges?.visibleDialogsBefore);
  const after = visibleDialogCount(step.observedChanges?.visibleDialogsAfter);
  return after > before;
}

function dialogClosed(step: FlowStepResult): boolean {
  const before = visibleDialogCount(step.observedChanges?.visibleDialogsBefore);
  const after = visibleDialogCount(step.observedChanges?.visibleDialogsAfter);
  return before > after && after === 0;
}

function targetIdentity(parts?: string[]): string | undefined {
  if (!parts?.length) return undefined;
  const last = parts[parts.length - 1]!;
  const idMatch = last.match(/#([^\s>]+)/);
  if (idMatch) return `#${idMatch[1]}`;
  return last;
}

function sameControl(targetA?: string[], targetB?: string[]): boolean {
  const a = targetIdentity(targetA);
  const b = targetIdentity(targetB);
  return Boolean(a && b && a === b);
}

function focusInsideDialog(step: FlowStepResult): boolean {
  const active = step.observedChanges?.activeElementAfter;
  const before = step.observedChanges?.activeElementBefore;
  const dialogs = step.observedChanges?.visibleDialogsAfter ?? [];
  if (dialogs.length === 0 || !active) {
    return false;
  }
  if (sameControl(step.target, active.target)) {
    return false;
  }
  if (sameControl(before?.target, active.target)) {
    return false;
  }
  return true;
}

function routeChanged(step: FlowStepResult): boolean {
  const before = step.observedChanges?.urlBefore;
  const after = step.observedChanges?.urlAfter;
  if (!before || !after) return false;
  try {
    return new URL(before).pathname !== new URL(after).pathname;
  } catch {
    return before !== after;
  }
}

function newErrorsAppeared(step: FlowStepResult): boolean {
  const before = step.observedChanges?.errorMessagesBefore?.length ?? 0;
  const after = step.observedChanges?.errorMessagesAfter?.length ?? 0;
  return after > before;
}

export function evaluateFlowRules(
  input: FlowRuleEvaluationInput,
  _context: RuleEvaluationContext,
): RuleFindingInput[] {
  const findings: RuleFindingInput[] = [];
  let lastDialogOpenerTarget: string[] | undefined;

  for (const step of input.steps) {
    if (step.status !== "completed") continue;

    if (dialogOpened(step)) {
      lastDialogOpenerTarget = step.observedChanges?.activeElementBefore?.target ?? step.target;
      if (!focusInsideDialog(step)) {
        findings.push({
          ruleId: "dialog-focus-entry",
          title: "Focus did not move into the opened dialog",
          description:
            "A dialog became visible but keyboard focus remained outside the dialog surface.",
          severity: "high",
          confidence: "medium",
          automation: "heuristic",
          target: step.observedChanges?.activeElementAfter?.target ?? ["document"],
        });
      }
    }

    if (dialogClosed(step)) {
      const after = step.observedChanges?.activeElementAfter?.target;
      const returned =
        lastDialogOpenerTarget &&
        after &&
        after.join("|") === lastDialogOpenerTarget.join("|");
      if (!returned) {
        findings.push({
          ruleId: "dialog-focus-return-review",
          title: "Dialog closed without clear focus return",
          description:
            "A dialog closed but focus did not return to the element that opened it. Manual review is recommended.",
          severity: "medium",
          confidence: "low",
          automation: "manual-review",
          target: after ?? ["document"],
        });
      }
      lastDialogOpenerTarget = undefined;
    }

    if (routeChanged(step)) {
      const active = step.observedChanges?.activeElementAfter;
      const stayedOnTrigger =
        active?.target?.join("|") === step.observedChanges?.activeElementBefore?.target?.join("|");
      if (stayedOnTrigger || active?.role === "body") {
        findings.push({
          ruleId: "route-change-focus-review",
          title: "Route changed without observable focus management",
          description:
            "Navigation changed the URL but focus remained on the previous control or body.",
          severity: "medium",
          confidence: "low",
          automation: "manual-review",
          target: active?.target ?? ["document"],
        });
      }
    }

    if (newErrorsAppeared(step)) {
      const active = step.observedChanges?.activeElementAfter;
      const focusOnError = step.observedChanges?.errorMessagesAfter?.some((message) =>
        active?.accessibleName?.includes(message.accessibleName ?? ""),
      );
      if (!focusOnError) {
        findings.push({
          ruleId: "form-error-focus-review",
          title: "New form errors appeared without focus on an error target",
          description:
            "Validation errors became visible but focus did not move to an error summary or invalid control.",
          severity: "medium",
          confidence: "low",
          automation: "heuristic",
          target: active?.target ?? ["document"],
        });
      }
    }

    const statusMessages = step.observedChanges?.visibleDialogsAfter?.filter(
      (item) => item.role === "status" || item.role === "alert",
    );
    if ((statusMessages?.length ?? 0) === 0 && newErrorsAppeared(step)) {
      findings.push({
        ruleId: "status-message-review",
        title: "Important status change may lack a live region",
        description:
          "A visible status change occurred without a detectable status or alert region. Manual review is recommended.",
        severity: "minor",
        confidence: "low",
        automation: "manual-review",
        target: ["document"],
      });
    }
  }

  return findings.map((finding) => ({
    ...finding,
    standards: finding.standards ?? ["WCAG 2.2 2.4.3 related"],
  }));
}
