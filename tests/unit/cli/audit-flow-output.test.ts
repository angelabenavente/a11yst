import { describe, expect, it } from "vitest";
import {
  formatFlowExecutionsHuman,
  hasFlowExecutions,
} from "../../../packages/cli/src/commands/audit-flow-output.js";
import type { AuditExecutionResult, AuditRunResult, Finding } from "@a11yst/types";

function flowResult(overrides: Partial<AuditExecutionResult> = {}): AuditExecutionResult {
  const finding: Finding = {
    id: "form-error-focus-review::site::checkout::validation-errors::keyboard::desktop::document",
    fingerprint: "form-error-focus-review::site",
    source: "a11yst",
    ruleId: "form-error-focus-review",
    title: "New form errors appeared without focus on an error target",
    description:
      "Validation errors became visible but focus did not move to an error summary or invalid control.",
    severity: "medium",
    projectName: "site",
    profile: "keyboard",
    viewport: "desktop",
    route: "/checkout",
    url: "http://127.0.0.1/checkout",
    target: ["document"],
    flowId: "checkout-validation-errors",
    checkpointId: "validation-errors",
    automation: "heuristic",
    standards: [],
  };

  const run: AuditRunResult = {
    runId: "run-1",
    kind: "flow-checkpoint",
    projectName: "site",
    platform: "web",
    framework: "react",
    profile: "keyboard",
    viewport: { name: "desktop", width: 1440, height: 900 },
    status: "completed",
    startedAt: "2026-08-03T10:00:00.000Z",
    durationMs: 500,
    findings: [finding],
    diagnostics: [],
    flowId: "checkout-validation-errors",
    checkpointId: "validation-errors",
    route: "/",
    url: "http://127.0.0.1/checkout",
  };

  return {
    schemaVersion: "1",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: "2026-08-03T10:00:00.000Z",
      durationMs: 500,
      plannedRuns: 1,
      completedRuns: 1,
      skippedRuns: 0,
      failedRuns: 0,
      findingCount: 1,
      findingsBySeverity: { critical: 0, high: 0, medium: 1, minor: 0 },
    },
    plan: { projects: [], runs: [], totalRuns: 1, diagnostics: [], createdAt: "2026-08-03T10:00:00.000Z" },
    runs: [run],
    findings: [finding],
    diagnostics: [],
    limitations: [],
    environment: {
      product: "a11yst",
      productVersion: "0.1.0",
      nodeVersion: "20.0.0",
      browser: "chromium",
      headed: false,
    },
    flowExecutions: [
      {
        schemaVersion: "1",
        projectName: "site",
        flowId: "checkout-validation-errors",
        flowName: "Checkout validation errors",
        profile: "keyboard",
        viewport: "desktop",
        sessionId: "session-1",
        startedAt: "2026-08-03T10:00:00.000Z",
        durationMs: 500,
        status: "completed",
        steps: [
          {
            index: 0,
            action: "click",
            status: "completed",
            startedAt: "2026-08-03T10:00:00.000Z",
            durationMs: 100,
            locator: { strategy: "role", description: 'button "Place order"' },
            diagnostics: [],
          },
          {
            index: 1,
            action: "checkpoint",
            status: "completed",
            startedAt: "2026-08-03T10:00:00.100Z",
            durationMs: 200,
            checkpointId: "validation-errors",
            diagnostics: [],
          },
          {
            index: 2,
            action: "expect-visible",
            status: "skipped",
            startedAt: "2026-08-03T10:00:00.300Z",
            durationMs: 0,
            failureReason: "a previous required step failed",
            diagnostics: [],
          },
        ],
        checkpoints: [],
        diagnostics: [],
      },
    ],
    flowSummary: {
      configuredFlows: 1,
      completedFlows: 1,
      failedFlows: 0,
      completedCheckpoints: 1,
      skippedCheckpoints: 0,
      failedCheckpoints: 0,
    },
    ...overrides,
  };
}

describe("formatFlowExecutionsHuman", () => {
  it("renders FLOW, VIEW, PROFILE, STEP, CHECKPOINT, PASS, ISSUES, and SKIPPED labels", () => {
    const lines = formatFlowExecutionsHuman(flowResult());
    const text = lines.join("\n");

    expect(text).toContain("FLOW  checkout-validation-errors");
    expect(text).toContain("VIEW  desktop");
    expect(text).toContain("PROFILE keyboard");
    expect(text).toMatch(/STEP {2}1\/3/);
    expect(text).toContain("PASS");
    expect(text).toContain("CHECKPOINT  validation-errors");
    expect(text).toContain("ISSUES");
    expect(text).not.toContain("FAIL        ");
    expect(text).toContain("SKIPPED");
    expect(text).toContain("Reason: a previous required step failed");
    expect(text).toContain("Flows summary");
  });

  it("returns empty output when no flow executions exist", () => {
    const empty = flowResult({ flowExecutions: [] });
    expect(formatFlowExecutionsHuman(empty)).toEqual([]);
    expect(hasFlowExecutions(empty)).toBe(false);
  });

  it("sanitizes locator descriptions containing redacted markers", () => {
    const redacted = flowResult({
      flowExecutions: [
        {
          ...flowResult().flowExecutions![0]!,
          steps: [
            {
              index: 0,
              action: "fill",
              status: "completed",
              startedAt: "2026-08-03T10:00:00.000Z",
              durationMs: 50,
              locator: { strategy: "role", description: 'textbox "Card" [REDACTED]' },
              diagnostics: [],
            },
          ],
        },
      ],
    });
    const text = formatFlowExecutionsHuman(redacted).join("\n");
    expect(text).toContain("[REDACTED]");
    expect(text).not.toMatch(/4242/);
  });
});
