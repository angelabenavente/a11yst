import { describe, expect, it } from "vitest";
import {
  formatPolicyEvaluationHuman,
  formatPolicyEvaluationSection,
} from "../../../packages/cli/src/commands/audit-policy-output.js";
import { evaluateCiPolicy } from "@a11yst/policy";
import {
  expiredAcceptedRiskFinding,
  falsePositiveFinding,
  newSeriousRouteFinding,
  policy,
  regressedCriticalFlowFinding,
} from "../policy/fixtures.js";

describe("formatPolicyEvaluationHuman", () => {
  it("formats failed policy with breaches in deterministic order", () => {
    const evaluation = evaluateCiPolicy({
      policy: policy({ failOnNew: true, failOnRegression: true }),
      baselineUsed: true,
      findings: [
        regressedCriticalFlowFinding(),
        newSeriousRouteFinding(),
      ],
    });

    const output = formatPolicyEvaluationHuman(
      evaluation,
      "high",
      [newSeriousRouteFinding(), regressedCriticalFlowFinding()],
    ).join("\n");

    expect(output).toContain("CI policy");
    expect(output).toContain("FAILED");
    expect(output).toContain("Minimum severity");
    expect(output).toContain("HIGH");
    expect(output).toContain("HIGH  NEW");
    expect(output).toContain("CRITICAL  REGRESSED");
    expect(output).toContain("Flow        checkout");
    expect(output).toContain("Checkpoint  cart-ready");
    expect(output).toContain("Reason: severity-increased");
    expect(output.includes("\u001B")).toBe(false);
    expect(output).not.toContain("<html");
    expect(output).not.toContain("password");
    expect(output).not.toContain("SERIOUS");
  });

  it("formats not-evaluated without presenting as pass", () => {
    const evaluation = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: false,
      findings: [newSeriousRouteFinding()],
    });

    const output = formatPolicyEvaluationHuman(evaluation, "high").join("\n");
    expect(output).toContain("NOT EVALUATED");
    expect(output).toContain("requires a baseline comparison");
  });

  it("formats expired classification with owner and expiry from findings", () => {
    const finding = expiredAcceptedRiskFinding();
    const evaluation = evaluateCiPolicy({
      policy: policy({
        failOnExpiredClassification: true,
        minimumSeverity: "medium",
      }),
      baselineUsed: true,
      findings: [finding],
    });

    const output = formatPolicyEvaluationHuman(evaluation, "medium", [finding]).join("\n");
    expect(output).toContain("EXPIRED CLASSIFICATION");
    expect(output).toContain("Owner:");
    expect(output).toContain("Expired:");
  });

  it("does not add CI section noise when policy is disabled", () => {
    const evaluation = evaluateCiPolicy({
      policy: policy(),
      baselineUsed: true,
      findings: [newSeriousRouteFinding(), falsePositiveFinding()],
    });

    const section = formatPolicyEvaluationSection(evaluation, {
      minimumSeverity: "high",
      findings: [newSeriousRouteFinding()],
    });
    expect(section).toEqual([]);
  });
});
