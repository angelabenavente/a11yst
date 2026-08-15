import { describe, expect, it } from "vitest";
import { evaluateCiPolicy, getAuditExitCode } from "@a11yst/policy";
import { newSeriousRouteFinding, policy } from "./fixtures.js";

describe("getAuditExitCode", () => {
  it("returns 0 without policy evaluation", () => {
    expect(getAuditExitCode({})).toBe(0);
  });

  it("returns 0 when policy is disabled", () => {
    const evaluation = evaluateCiPolicy({
      policy: policy(),
      baselineUsed: false,
      findings: [newSeriousRouteFinding()],
    });
    expect(getAuditExitCode({ policyEvaluation: evaluation })).toBe(0);
  });

  it("returns 0 when policy passed", () => {
    const evaluation = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: true,
      findings: [],
    });
    expect(evaluation.status).toBe("passed");
    expect(getAuditExitCode({ policyEvaluation: evaluation })).toBe(0);
  });

  it("returns 2 when policy failed", () => {
    const evaluation = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: true,
      findings: [newSeriousRouteFinding()],
    });
    expect(evaluation.status).toBe("failed");
    expect(getAuditExitCode({ policyEvaluation: evaluation })).toBe(2);
  });

  it("returns 1 when policy is not evaluated", () => {
    const evaluation = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: false,
      findings: [newSeriousRouteFinding()],
    });
    expect(evaluation.status).toBe("not-evaluated");
    expect(getAuditExitCode({ policyEvaluation: evaluation })).toBe(1);
  });

  it("returns 1 for operational error without policy", () => {
    expect(getAuditExitCode({ operationalError: true })).toBe(1);
  });

  it("returns 1 for operational error even when policy failed", () => {
    const evaluation = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: true,
      findings: [newSeriousRouteFinding()],
    });
    expect(
      getAuditExitCode({
        operationalError: true,
        policyEvaluation: evaluation,
      }),
    ).toBe(1);
  });

  it("returns 1 when audit did not complete", () => {
    expect(getAuditExitCode({ auditIncomplete: true })).toBe(1);
  });

  it("returns 0 for completed audit with zero findings and disabled policy", () => {
    const evaluation = evaluateCiPolicy({
      policy: policy(),
      baselineUsed: true,
      findings: [],
    });
    expect(getAuditExitCode({ policyEvaluation: evaluation })).toBe(0);
  });
});
