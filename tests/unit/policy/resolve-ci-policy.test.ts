import { describe, expect, it } from "vitest";
import { DEFAULT_CI_POLICY } from "@a11yst/types";
import { resolveCiPolicyConfig } from "@a11yst/policy";

describe("resolveCiPolicyConfig", () => {
  const configPolicy = {
    failOnNew: false,
    failOnRegression: true,
    failOnExpiredClassification: false,
    minimumSeverity: "high" as const,
  };

  it("returns config defaults when CLI overrides are absent", () => {
    expect(
      resolveCiPolicyConfig({
        configPolicy: DEFAULT_CI_POLICY,
      }),
    ).toEqual(DEFAULT_CI_POLICY);
  });

  it("enables failOnNew from CLI", () => {
    expect(
      resolveCiPolicyConfig({
        configPolicy: DEFAULT_CI_POLICY,
        cliOverrides: { failOnNew: true },
      }).failOnNew,
    ).toBe(true);
  });

  it("disables failOnNew configured in config via CLI", () => {
    expect(
      resolveCiPolicyConfig({
        configPolicy: { ...DEFAULT_CI_POLICY, failOnNew: true },
        cliOverrides: { failOnNew: false },
      }).failOnNew,
    ).toBe(false);
  });

  it("enables and disables regression from CLI", () => {
    expect(
      resolveCiPolicyConfig({
        configPolicy,
        cliOverrides: { failOnRegression: false },
      }).failOnRegression,
    ).toBe(false);
    expect(
      resolveCiPolicyConfig({
        configPolicy: DEFAULT_CI_POLICY,
        cliOverrides: { failOnRegression: true },
      }).failOnRegression,
    ).toBe(true);
  });

  it("enables and disables expired classification from CLI", () => {
    expect(
      resolveCiPolicyConfig({
        configPolicy,
        cliOverrides: { failOnExpiredClassification: true },
      }).failOnExpiredClassification,
    ).toBe(true);
    expect(
      resolveCiPolicyConfig({
        configPolicy: { ...DEFAULT_CI_POLICY, failOnExpiredClassification: true },
        cliOverrides: { failOnExpiredClassification: false },
      }).failOnExpiredClassification,
    ).toBe(false);
  });

  it("overrides minimum severity from CLI", () => {
    expect(
      resolveCiPolicyConfig({
        configPolicy,
        cliOverrides: { minimumSeverity: "critical" },
      }).minimumSeverity,
    ).toBe("critical");
  });

  it("preserves config when CLI override is absent", () => {
    expect(
      resolveCiPolicyConfig({
        configPolicy,
        cliOverrides: { failOnNew: true },
      }),
    ).toEqual({
      failOnNew: true,
      failOnRegression: true,
      failOnExpiredClassification: false,
      minimumSeverity: "high",
    });
  });

  it("does not mutate config input", () => {
    const input = { ...configPolicy };
    resolveCiPolicyConfig({ configPolicy: input, cliOverrides: { failOnNew: true } });
    expect(input).toEqual(configPolicy);
  });
});
