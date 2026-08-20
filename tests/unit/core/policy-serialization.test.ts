import { describe, expect, it } from "vitest";
import { evaluateCiPolicy } from "@a11yst/policy";
import { newSeriousRouteFinding, policy } from "../policy/fixtures.js";

describe("policyEvaluation serialisation", () => {
  it("serialises policyEvaluation without undefined properties", () => {
    const evaluation = evaluateCiPolicy({
      policy: policy({ failOnNew: true }),
      baselineUsed: true,
      findings: [newSeriousRouteFinding()],
    });

    const serialised = JSON.parse(
      JSON.stringify({
        schemaVersion: "1",
        policyEvaluation: evaluation,
      }),
    ) as { policyEvaluation: { breaches: Array<Record<string, unknown>> } };

    expect(JSON.stringify(serialised)).not.toContain("undefined");
    expect(serialised.policyEvaluation.breaches[0]).not.toHaveProperty("html");
    expect(serialised.policyEvaluation.breaches[0]).not.toHaveProperty("evidence");
    expect(serialised.policyEvaluation.breaches[0]).not.toHaveProperty("password");
  });

  it("accepts legacy results without policyEvaluation", () => {
    const legacy = {
      schemaVersion: "1" as const,
      status: "completed" as const,
      summary: {
        status: "completed" as const,
        startedAt: "2020-01-01T00:00:00.000Z",
        completedAt: "2020-01-01T00:00:01.000Z",
        durationMs: 1000,
        plannedRuns: 1,
        completedRuns: 1,
        skippedRuns: 0,
        failedRuns: 0,
        findingCount: 0,
        findingsBySeverity: { minor: 0, medium: 0, high: 0, critical: 0 },
      },
      plan: { projects: [], runs: [], diagnostics: [] },
      runs: [],
      findings: [],
      diagnostics: [],
      limitations: [],
      environment: {
        product: "a11yst",
        productVersion: "1.0.0",
        nodeVersion: "v20.0.0",
        headed: false,
      },
    };

    expect((legacy as { policyEvaluation?: unknown }).policyEvaluation).toBeUndefined();
    expect(() => JSON.parse(JSON.stringify(legacy))).not.toThrow();
  });
});
