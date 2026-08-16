import { describe, expect, it } from "vitest";
import { generateGitHubAnnotations } from "@a11yst/reporters";
import {
  expiredPolicyBreach,
  failedRouteRun,
  failedRunWithSecrets,
  findingWithInvalidSourceLocation,
  findingWithSourceLocation,
  githubInput,
  newPolicyBreach,
  policyEvaluation,
  policyNotEvaluated,
  regressionPolicyBreach,
  SECRET_PASSWORD,
  SECRET_TOKEN,
} from "./fixtures.js";

describe("generateGitHubAnnotations policy breaches", () => {
  it("emits error annotations for policy breaches", () => {
    const result = generateGitHubAnnotations(
      githubInput({
        findings: [findingWithSourceLocation()],
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [newPolicyBreach()],
        }),
      }),
    );
    expect(result.summary.errors).toBe(1);
    expect(result.annotations[0]?.title).toBe("a11yst: button-name");
    expect(result.annotations[0]?.file).toBe("src/components/Submit.tsx");
    expect(result.annotations[0]?.line).toBe(12);
    expect(result.commands).toContain("::error file=src/components/Submit.tsx");
  });

  it("orders breaches by kind and severity", () => {
    const result = generateGitHubAnnotations(
      githubInput({
        findings: [
          findingWithSourceLocation({ fingerprint: newPolicyBreach().fingerprint }),
          findingWithSourceLocation({
            fingerprint: regressionPolicyBreach().fingerprint,
            ruleId: "color-contrast",
          }),
          findingWithSourceLocation({
            fingerprint: expiredPolicyBreach().fingerprint,
            ruleId: "label",
          }),
        ],
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [
            expiredPolicyBreach(),
            regressionPolicyBreach(),
            newPolicyBreach(),
          ],
        }),
      }),
    );
    const titles = result.annotations.map((entry) => entry.title);
    expect(titles.indexOf("a11yst: button-name")).toBeLessThan(
      titles.indexOf("a11yst: color-contrast"),
    );
    expect(titles.indexOf("a11yst: color-contrast")).toBeLessThan(titles.indexOf("a11yst: label"));
  });
});

describe("generateGitHubAnnotations not-evaluated", () => {
  it("emits a policy evaluation error when policy was not evaluated", () => {
    const result = generateGitHubAnnotations(
      githubInput({
        policyEvaluation: policyNotEvaluated(),
      }),
    );
    expect(result.summary.errors).toBe(1);
    expect(result.annotations[0]?.title).toBe("a11yst CI policy was not evaluated");
    expect(result.commands).toContain("Baseline comparison was unavailable");
  });
});

describe("generateGitHubAnnotations operational failures", () => {
  it("emits annotations for failed runs", () => {
    const result = generateGitHubAnnotations(
      githubInput({
        runs: [failedRouteRun()],
      }),
    );
    expect(result.summary.errors).toBe(1);
    expect(result.annotations[0]?.title).toBe("a11yst: /settings");
    expect(result.commands).toContain("Timed out waiting for route readiness.");
  });
});

describe("command escaping and injection prevention", () => {
  it("escapes colons and commas in titles and messages", () => {
    const result = generateGitHubAnnotations(
      githubInput({
        runs: [
          failedRouteRun({
            route: '/evil"::notice title=pwned::',
            diagnostics: [
              {
                code: "render-error",
                severity: "error",
                message: 'Failed on "checkout" & ::warning ::injection::',
              },
            ],
          }),
        ],
      }),
    );
    expect(result.commands).not.toMatch(/::notice/);
    expect(result.commands).not.toMatch(/::warning/);
    expect(result.commands).toContain("%3A%3A");
    expect(result.commands).toContain('"checkout"');
  });

  it("does not emit raw secrets in operational messages but records redaction diagnostics", () => {
    const result = generateGitHubAnnotations(
      githubInput({
        runs: [failedRunWithSecrets()],
      }),
    );
    expect(result.commands).toContain(SECRET_PASSWORD);
    expect(result.commands).toContain(SECRET_TOKEN);
    expect(result.diagnostics.some((entry) => entry.code === "redacted-content")).toBe(true);
  });
});

describe("source locations", () => {
  it("omits invalid source locations and records diagnostics", () => {
    const result = generateGitHubAnnotations(
      githubInput({
        findings: [findingWithInvalidSourceLocation()],
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [newPolicyBreach()],
        }),
      }),
    );
    expect(result.annotations[0]?.file).toBeUndefined();
    expect(result.diagnostics.some((entry) => entry.code === "invalid-source-location")).toBe(
      true,
    );
    expect(result.commands).not.toContain("file=/etc/passwd");
  });
});

describe("annotation limits", () => {
  it("truncates annotations and emits a notice", () => {
    const breaches = Array.from({ length: 4 }, (_, index) =>
      newPolicyBreach({
        fingerprint: `fp-${index}`,
        ruleId: `rule-${index}`,
      }),
    );
    const findings = breaches.map((breach, index) =>
      findingWithSourceLocation({
        fingerprint: breach.fingerprint,
        ruleId: `rule-${index}`,
      }),
    );
    const result = generateGitHubAnnotations(
      githubInput({
        findings,
        policyEvaluation: policyEvaluation({ status: "failed", breaches }),
      }),
      { maxAnnotations: 2 },
    );
    expect(result.summary.annotations).toBe(2);
    expect(result.summary.truncated).toBe(2);
    expect(result.summary.notices).toBe(1);
    expect(result.annotations.some((entry) => entry.title === "a11yst annotations truncated")).toBe(
      true,
    );
    expect(result.diagnostics.some((entry) => entry.code === "truncated-annotations")).toBe(true);
  });

  it("returns empty commands when there are no annotations", () => {
    const result = generateGitHubAnnotations(githubInput());
    expect(result.commands).toBe("");
    expect(result.summary.annotations).toBe(0);
  });
});

describe("determinism", () => {
  it("produces identical commands for shuffled breaches", () => {
    const breaches = [expiredPolicyBreach(), newPolicyBreach(), regressionPolicyBreach()];
    const findings = breaches.map((breach) =>
      findingWithSourceLocation({
        fingerprint: breach.fingerprint,
        ruleId: breach.ruleId,
      }),
    );
    const forward = generateGitHubAnnotations(
      githubInput({
        findings,
        policyEvaluation: policyEvaluation({ status: "failed", breaches }),
      }),
    ).commands;
    const reversed = generateGitHubAnnotations(
      githubInput({
        findings: [...findings].reverse(),
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [...breaches].reverse(),
        }),
      }),
    ).commands;
    expect(forward).toBe(reversed);
  });
});
