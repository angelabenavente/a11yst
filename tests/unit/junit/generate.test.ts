import { describe, expect, it } from "vitest";
import { generateJunit, serializeJunit } from "@a11yst/junit";
import {
  baseInput,
  completeComparisonInput,
  completedFlowCheckpoint,
  completedRouteRun,
  expiredPolicyBreach,
  failedRouteRun,
  hostileFindingMetadata,
  knownFinding,
  newPolicyBreach,
  notComparedFinding,
  policyEvaluation,
  policyNotEvaluated,
  regressionPolicyBreach,
  resolvedFindingEntry,
  SECRET_PASSWORD,
  SECRET_TOKEN,
  skippedExpoRun,
} from "./fixtures.js";
import { validateJunitXml } from "./xml-helper.js";

function serialized(input: Parameters<typeof generateJunit>[0], options?: Parameters<typeof generateJunit>[1]): string {
  return serializeJunit(generateJunit(input, options).document);
}

describe("generateJunit structure", () => {
  it("generates a minimal valid JUnit document", () => {
    const result = generateJunit(baseInput());
    expect(result.document.name).toBe("a11yst accessibility audit");
    expect(result.document.suites).toHaveLength(1);
    expect(result.document.suites[0]?.name).toBe("a11yst / default");
    expect(result.document.tests).toBe(0);
    expect(result.summary.suites).toBe(1);
    validateJunitXml(serialized(baseInput()));
  });

  it("creates one suite per project sorted alphabetically", () => {
    const result = generateJunit(
      baseInput({
        runs: [
          completedRouteRun({ projectName: "zebra" }),
          completedRouteRun({ projectName: "alpha" }),
          completedRouteRun({ projectName: "middle" }),
        ],
      }),
    );
    expect(result.document.suites.map((suite) => suite.name)).toEqual([
      "a11yst / alpha",
      "a11yst / middle",
      "a11yst / zebra",
    ]);
    validateJunitXml(serializeJunit(result.document));
  });

  it("uses a custom suite prefix", () => {
    const result = generateJunit(baseInput(), { suiteName: "CI" });
    expect(result.document.name).toBe("CI accessibility audit");
    expect(result.document.suites[0]?.name).toBe("CI / default");
  });
});

describe("run testcases", () => {
  it("represents completed, skipped, and failed route runs", () => {
    const result = generateJunit(
      baseInput({
        runs: [completedRouteRun(), skippedExpoRun(), failedRouteRun()],
      }),
    );
    expect(result.document.tests).toBe(3);
    expect(result.document.skipped).toBe(1);
    expect(result.document.errors).toBe(1);

    const storefront = result.document.suites.find((entry) => entry.name === "a11yst / storefront");
    expect(storefront?.tests).toBe(2);
    expect(storefront?.errors).toBe(1);
    expect(storefront?.testcases.map((testcase) => testcase.name)).toEqual([
      "route /settings [keyboard, desktop]",
      "route /checkout [default, desktop]",
    ]);

    const mobile = result.document.suites.find((entry) => entry.name === "a11yst / mobile");
    expect(mobile?.skipped).toBe(1);
    validateJunitXml(serializeJunit(result.document));
  });

  it("represents completed flow checkpoint runs", () => {
    const result = generateJunit(
      baseInput({
        runs: [completedFlowCheckpoint()],
      }),
    );
    const testcase = result.document.suites[0]?.testcases[0];
    expect(testcase?.name).toBe(
      "flow checkout / checkpoint payment-dialog-open [keyboard, desktop]",
    );
    expect(testcase?.classname).toBe("storefront.flow");
    validateJunitXml(serializeJunit(result.document));
  });

  it("includes profile names in testcase titles", () => {
    const result = generateJunit(
      baseInput({
        runs: [
          completedRouteRun({ profile: "keyboard" }),
          completedFlowCheckpoint({ profile: "large-text" }),
        ],
      }),
    );
    const names = result.document.suites[0]?.testcases.map((testcase) => testcase.name) ?? [];
    expect(names.some((name) => name.includes("[keyboard"))).toBe(true);
    expect(names.some((name) => name.includes("[large-text"))).toBe(true);
  });

  it("omits passing runs when includePassingRunCases is false", () => {
    const result = generateJunit(
      baseInput({ runs: [completedRouteRun(), failedRouteRun()] }),
      { includePassingRunCases: false },
    );
    expect(result.document.tests).toBe(1);
    expect(result.document.errors).toBe(1);
  });

  it("omits skipped runs when includeSkippedRunCases is false", () => {
    const result = generateJunit(
      baseInput({ runs: [skippedExpoRun(), completedRouteRun()] }),
      { includeSkippedRunCases: false },
    );
    expect(result.document.skipped).toBe(0);
    expect(result.document.tests).toBe(1);
  });
});

describe("policy metadata", () => {
  it("marks policy as disabled when evaluation is absent", () => {
    const result = generateJunit(baseInput());
    expect(
      result.document.suites[0]?.properties?.find((entry) => entry.name === "a11yst.policy.enabled")
        ?.value,
    ).toBe("false");
  });

  it("records passed policy without failures", () => {
    const result = generateJunit(
      baseInput({
        policyEvaluation: policyEvaluation({ status: "passed", policyEnabled: true }),
      }),
    );
    expect(result.document.failures).toBe(0);
    expect(
      result.document.suites[0]?.properties?.find((entry) => entry.name === "a11yst.policy.status")
        ?.value,
    ).toBe("passed");
    validateJunitXml(serializeJunit(result.document));
  });

  it("creates failure testcases for new, regression, and expired breaches", () => {
    const result = generateJunit(
      baseInput({
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [newPolicyBreach(), regressionPolicyBreach(), expiredPolicyBreach()],
        }),
      }),
    );
    expect(result.document.failures).toBe(3);
    const names = result.document.suites[0]?.testcases.map((testcase) => testcase.name) ?? [];
    expect(names.some((name) => name.startsWith("policy / new /"))).toBe(true);
    expect(names.some((name) => name.startsWith("policy / regression /"))).toBe(true);
    expect(names.some((name) => name.startsWith("policy / expired-classification /"))).toBe(true);
    validateJunitXml(serializeJunit(result.document));
  });

  it("creates a policy evaluation error when policy was not evaluated", () => {
    const result = generateJunit(
      baseInput({
        policyEvaluation: policyNotEvaluated(),
      }),
    );
    expect(result.document.errors).toBe(1);
    const testcase = result.document.suites[0]?.testcases[0];
    expect(testcase?.name).toBe("policy / evaluation");
    expect(testcase?.error?.type).toBe("a11ystPolicyNotEvaluated");
    validateJunitXml(serializeJunit(result.document));
  });

  it("includes minimum severity when provided", () => {
    const result = generateJunit(
      baseInput({
        policyEvaluation: policyEvaluation({ status: "passed", policyEnabled: true }),
        policyMinimumSeverity: "high",
      }),
    );
    expect(
      result.document.suites[0]?.properties?.find(
        (entry) => entry.name === "a11yst.policy.minimumSeverity",
      )?.value,
    ).toBe("high");
  });
});

describe("findings do not create failures", () => {
  it("does not emit failures for known, resolved, or not-compared findings", () => {
    const result = generateJunit(
      completeComparisonInput({
        findings: [knownFinding(), notComparedFinding()],
        resolvedFindings: [resolvedFindingEntry()],
        baselineSummary: {
          baselineUsed: true,
          baselinePath: ".a11yst/baseline.json",
          currentFindings: 2,
          newFindings: 0,
          knownFindings: 1,
          regressedFindings: 0,
          resolvedFindings: 1,
          notComparedFindings: 1,
          expiredClassifications: 0,
          dispositions: {
            falsePositive: 0,
            acceptedRisk: 0,
            thirdParty: 0,
            notApplicable: 0,
            manualReview: 0,
          },
        },
      }),
    );
    expect(result.document.failures).toBe(0);
    expect(result.document.errors).toBe(0);
    expect(result.document.tests).toBe(0);
    validateJunitXml(serializeJunit(result.document));
  });
});

describe("counts and durations", () => {
  it("aggregates suite and root metrics", () => {
    const result = generateJunit(
      baseInput({
        runs: [completedRouteRun({ durationMs: 1000 }), failedRouteRun({ durationMs: 500 })],
        audit: { successful: false, durationMs: 2500 },
      }),
    );
    expect(result.document.tests).toBe(2);
    expect(result.document.errors).toBe(1);
    expect(result.document.time).toBe(1.5);
    expect(result.summary.timeSeconds).toBe(1.5);
    validateJunitXml(serializeJunit(result.document));
  });

  it("reports zero time when no testcase durations exist", () => {
    const result = generateJunit(
      baseInput({
        audit: { successful: true, durationMs: 4321 },
      }),
    );
    expect(result.document.time).toBe(0);
    validateJunitXml(serializeJunit(result.document));
  });
});

describe("determinism and deduplication", () => {
  it("produces identical XML for shuffled runs and breaches", () => {
    const runs = [failedRouteRun(), completedRouteRun(), completedFlowCheckpoint()];
    const breaches = [expiredPolicyBreach(), newPolicyBreach(), regressionPolicyBreach()];
    const forward = serialized(
      baseInput({
        runs,
        policyEvaluation: policyEvaluation({ status: "failed", breaches }),
      }),
    );
    const reversed = serialized(
      baseInput({
        runs: [...runs].reverse(),
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [...breaches].reverse(),
        }),
      }),
    );
    expect(forward).toBe(reversed);
    validateJunitXml(forward);
  });

  it("deduplicates duplicate policy breach fingerprints", () => {
    const breach = newPolicyBreach();
    const result = generateJunit(
      baseInput({
        policyEvaluation: policyEvaluation({
          status: "failed",
          breaches: [breach, { ...breach }],
        }),
      }),
    );
    expect(result.document.failures).toBe(1);
    expect(result.diagnostics.some((entry) => entry.code === "duplicate-testcase")).toBe(true);
  });
});

describe("security and escaping", () => {
  it("does not copy secrets from hostile finding metadata into XML", () => {
    const xml = serialized(hostileFindingMetadata());
    expect(xml).not.toContain(SECRET_TOKEN);
    expect(xml).not.toContain(SECRET_PASSWORD);
    validateJunitXml(xml);
  });

  it("escapes XML special characters in testcase names and messages", () => {
    const xml = serialized(
      baseInput({
        runs: [
          failedRouteRun({
            route: `/quotes" & <tags>`,
            diagnostics: [
              {
                code: "render-error",
                severity: "error",
                message: `Failed on "checkout" & <dialog>`,
              },
            ],
          }),
        ],
      }),
    );
    expect(xml).toContain("&quot;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;");
    expect(xml).not.toMatch(/message="[^"]*<dialog>/);
    validateJunitXml(xml);
  });
});

describe("baseline document properties", () => {
  it("includes baseline summary properties when comparison is complete", () => {
    const result = generateJunit(completeComparisonInput({ findings: [knownFinding()] }));
    const names = result.document.properties?.map((entry) => entry.name) ?? [];
    expect(names).toContain("a11yst.baseline.used");
    expect(names).toContain("a11yst.findings.known");
    validateJunitXml(serializeJunit(result.document));
  });

  it("marks comparison incomplete when not-compared findings exist", () => {
    const result = generateJunit(
      completeComparisonInput({
        findings: [notComparedFinding()],
        baselineSummary: {
          baselineUsed: true,
          baselinePath: ".a11yst/baseline.json",
          currentFindings: 1,
          newFindings: 0,
          knownFindings: 0,
          regressedFindings: 0,
          resolvedFindings: 0,
          notComparedFindings: 1,
          expiredClassifications: 0,
          dispositions: {
            falsePositive: 0,
            acceptedRisk: 0,
            thirdParty: 0,
            notApplicable: 0,
            manualReview: 0,
          },
        },
      }),
    );
    expect(
      result.document.properties?.find((entry) => entry.name === "a11yst.comparison.complete")
        ?.value,
    ).toBe("false");
  });
});
