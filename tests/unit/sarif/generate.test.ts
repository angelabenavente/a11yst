import { describe, expect, it } from "vitest";
import {
  generateSarif,
  mapSeverityToSarifLevel,
  SARIF_SCHEMA_URL,
  serializeSarif,
} from "@a11yst/sarif";
import {
  a11ystFlowFinding,
  axeRouteFinding,
  baseInput,
  completeComparisonInput,
  expiredAcceptedRiskFinding,
  falsePositiveFinding,
  findingWithSourceLocation,
  findingWithoutSourceLocation,
  hostileFinding,
  policyEvaluation,
  regressedCriticalFinding,
} from "./fixtures.js";
import { validateAgainstOfficialSchema } from "./schema-helper.js";

describe("generateSarif structure", () => {
  it("generates a minimal valid SARIF log", () => {
    const result = generateSarif(baseInput());
    expect(result.log.$schema).toBe(SARIF_SCHEMA_URL);
    expect(result.log.version).toBe("2.1.0");
    expect(result.log.runs).toHaveLength(1);
    expect(result.log.runs[0]?.tool.driver.name).toBe("a11yst");
    expect(result.log.runs[0]?.tool.driver.version).toBe("0.1.0");
    expect(result.log.runs[0]?.tool.driver.semanticVersion).toBe("0.1.0");
    expect(result.log.runs[0]?.results).toEqual([]);
    validateAgainstOfficialSchema(result.log);
  });

  it("includes one run with rules and results for findings", () => {
    const input = completeComparisonInput([
      axeRouteFinding(),
      a11ystFlowFinding(),
    ]);
    const result = generateSarif(input);
    expect(result.log.runs).toHaveLength(1);
    expect(result.summary.rules).toBe(2);
    expect(result.summary.results).toBe(2);
    validateAgainstOfficialSchema(result.log);
  });
});

describe("severity mapping", () => {
  it("maps a11yst severities to SARIF levels", () => {
    expect(mapSeverityToSarifLevel("minor")).toBe("note");
    expect(mapSeverityToSarifLevel("medium")).toBe("warning");
    expect(mapSeverityToSarifLevel("high")).toBe("error");
    expect(mapSeverityToSarifLevel("critical")).toBe("error");
  });

  it("does not change result level for classified findings", () => {
    const result = generateSarif(
      completeComparisonInput([falsePositiveFinding()]),
    );
    expect(result.log.runs[0]?.results[0]?.level).toBe("error");
    expect(result.log.runs[0]?.results[0]?.properties?.["a11yst.disposition"]).toBe(
      "false-positive",
    );
  });
});

describe("lifecycle and baselineState", () => {
  it("maps new, known, and regressed when comparison is complete", () => {
    const result = generateSarif(
      completeComparisonInput([
        axeRouteFinding(),
        a11ystFlowFinding(),
        regressedCriticalFinding(),
      ]),
    );
    const states = result.log.runs[0]?.results.map((entry) => entry.baselineState);
    expect(states).toContain("new");
    expect(states).toContain("unchanged");
    expect(states).toContain("updated");
    validateAgainstOfficialSchema(result.log);
  });

  it("omits baselineState when comparison is incomplete", () => {
    const result = generateSarif(
      baseInput({
        findings: [axeRouteFinding()],
        baselineSummary: {
          baselineUsed: true,
          currentFindings: 1,
          newFindings: 1,
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
    expect(result.log.runs[0]?.results.every((entry) => entry.baselineState === undefined)).toBe(
      true,
    );
    expect(result.log.runs[0]?.results[0]?.properties?.["a11yst.comparisonComplete"]).toBe(false);
  });
});

describe("policy metadata", () => {
  it("marks policy breaches on matching results without duplicating", () => {
    const finding = axeRouteFinding();
    const result = generateSarif(
      completeComparisonInput([finding], {
        policyEvaluation: policyEvaluation({
          failOnNew: true,
          status: "failed",
          breaches: [
            {
              kind: "new-finding",
              fingerprint: finding.fingerprint,
              ruleId: finding.ruleId,
              severity: finding.severity,
              projectName: finding.projectName,
              lifecycleStatus: "new",
              location: {
                kind: "route",
                route: "/checkout",
                profile: "default",
                viewport: "desktop",
              },
            },
          ],
        }),
      }),
    );
    expect(result.summary.results).toBe(1);
    expect(result.summary.policyBreaches).toBe(1);
    expect(result.log.runs[0]?.properties?.["a11yst.policy"]).toEqual({
      status: "failed",
      policyEnabled: true,
      totalBreaches: 1,
    });
    expect(result.log.runs[0]?.results[0]?.properties?.["a11yst.policyBreach"]).toBe(true);
  });
});

describe("locations", () => {
  it("uses physical locations only for validated source locations", () => {
    const result = generateSarif(
      completeComparisonInput([findingWithSourceLocation()]),
    );
    const sarifResult = result.log.runs[0]?.results[0];
    expect(sarifResult?.locations?.[0]?.physicalLocation?.artifactLocation.uri).toBe(
      "src/components/CheckoutButton.tsx",
    );
    expect(sarifResult?.locations?.[0]?.logicalLocations).toBeUndefined();
    validateAgainstOfficialSchema(result.log);
  });

  it("uses logical locations when source location is missing", () => {
    const result = generateSarif(
      completeComparisonInput([findingWithoutSourceLocation()]),
    );
    const sarifResult = result.log.runs[0]?.results[0];
    expect(sarifResult?.locations?.[0]?.physicalLocation).toBeUndefined();
    expect(sarifResult?.locations?.[0]?.logicalLocations?.[0]?.kind).toBe("route");
    expect(result.diagnostics.some((d) => d.code === "missing-source-location")).toBe(true);
  });

  it("creates flow logical locations", () => {
    const result = generateSarif(completeComparisonInput([a11ystFlowFinding()]));
    expect(result.log.runs[0]?.results[0]?.locations?.[0]?.logicalLocations?.[0]?.kind).toBe(
      "flow-checkpoint",
    );
  });
});

describe("fingerprints and determinism", () => {
  it("preserves a11yst fingerprints in partialFingerprints", () => {
    const finding = axeRouteFinding({ fingerprint: "fp-abc" });
    const result = generateSarif(completeComparisonInput([finding]));
    expect(result.log.runs[0]?.results[0]?.partialFingerprints).toEqual({
      "a11ystFingerprint/v1": "fp-abc",
    });
    expect(result.log.runs[0]?.results[0]?.partialFingerprints).not.toHaveProperty(
      "primaryLocationLineHash",
    );
  });

  it("produces identical output for shuffled input", () => {
    const findings = [
      regressedCriticalFinding(),
      axeRouteFinding(),
      a11ystFlowFinding(),
    ];
    const a = serializeSarif(generateSarif(completeComparisonInput(findings)).log);
    const b = serializeSarif(
      generateSarif(completeComparisonInput([...findings].reverse())).log,
    );
    expect(a).toBe(b);
  });

  it("deduplicates duplicate fingerprints", () => {
    const finding = axeRouteFinding();
    const result = generateSarif(completeComparisonInput([finding, { ...finding }]));
    expect(result.summary.results).toBe(1);
    expect(result.diagnostics.some((d) => d.code === "duplicate-result")).toBe(true);
  });
});

describe("security", () => {
  it("does not copy hostile HTML, secrets, or absolute paths into SARIF", () => {
    const serialized = serializeSarif(
      generateSarif(completeComparisonInput([hostileFinding()])).log,
    );
    expect(serialized).not.toContain("sk_live_a11yst_fixture_token_9c");
    expect(serialized).not.toContain("P@ssw0rd-fixture-9c");
    expect(serialized).not.toContain("<form>");
    expect(serialized).not.toContain("/etc/passwd");
    validateAgainstOfficialSchema(JSON.parse(serialized));
  });
});

describe("resolved findings", () => {
  it("does not emit resolved findings as SARIF results", () => {
    const result = generateSarif(
      completeComparisonInput([axeRouteFinding()], {
        resolvedFindings: [
          {
            fingerprint: "resolved-fp",
            fingerprintVersion: "1",
            ruleId: "button-name",
            source: "axe",
            projectName: "storefront",
            location: {
              kind: "route",
              route: "/old",
              profile: "default",
            },
            previousSeverity: "high",
            resolvedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      { includeResolvedSummary: true },
    );
    expect(result.summary.results).toBe(1);
    expect(result.log.runs[0]?.properties?.["a11yst.resolvedFindings"]).toBe(1);
  });
});

describe("classifications remain visible", () => {
  it("keeps false-positive and expired accepted-risk visible", () => {
    const result = generateSarif(
      completeComparisonInput([
        falsePositiveFinding(),
        expiredAcceptedRiskFinding(),
      ]),
    );
    expect(result.summary.results).toBe(2);
    const dispositions = result.log.runs[0]?.results.map(
      (entry) => entry.properties?.["a11yst.disposition"],
    );
    expect(dispositions).toContain("false-positive");
    expect(dispositions).toContain("accepted-risk");
    expect(result.log.runs[0]?.results.every((entry) => !("suppressions" in entry))).toBe(
      true,
    );
    validateAgainstOfficialSchema(result.log);
  });
});
