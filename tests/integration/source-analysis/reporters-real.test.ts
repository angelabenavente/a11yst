import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createGitHubAnnotationsInputFromAuditResult, createJunitInputFromAuditResult, createMarkdownInputFromAuditResult, createSarifInputFromAuditResult } from "@a11yst/core";
import { generateJunit, serializeJunit } from "@a11yst/junit";
import {
  generateGitHubAnnotations,
  generateHtmlReport,
  generateMarkdownReport,
  renderHtmlReport,
} from "@a11yst/reporters";
import { generateSarif } from "@a11yst/sarif";
import { validateAgainstOfficialSchema } from "../../unit/sarif/schema-helper.js";
import {
  EXPECTED_LOCATIONS,
  SENSITIVE_MARKERS,
  buildAuditResultFromAnalysis,
  representativeFindings,
  runRealAnalysis,
  serializedSafe,
} from "./fixtures.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("reporters on real enriched fixtures", () => {
  it("serializes mapped, ambiguous, and recommendation sections across formats", async () => {
    const analysis = await runRealAnalysis(representativeFindings(), {
      ranking: false,
      recommendations: true,
    });
    const mapped = analysis.findings.find((finding) => finding.id === "html-submit");
    const ambiguous = analysis.findings.find((finding) => finding.id === "html-ambiguous");
    expect(mapped?.sourceMapping?.status).toBe("mapped");
    expect(ambiguous?.sourceMapping?.status).toBe("ambiguous");

    const auditResult = buildAuditResultFromAnalysis(analysis, {
      policyEvaluation: {
        status: "failed",
        policyEnabled: true,
        baselineRequired: true,
        baselineUsed: true,
        breaches: [
          {
            kind: "new-finding",
            fingerprint: mapped!.fingerprint,
            ruleId: "button-name",
            severity: "high",
            projectName: "legacy-html",
            lifecycleStatus: "new",
            location: {
              kind: "route",
              route: "/checkout",
              profile: "default",
              viewport: "desktop",
            },
          },
        ],
        summary: {
          evaluatedFindings: analysis.findings.length,
          ignoredBySeverity: 0,
          excludedByDisposition: 0,
          newBreaches: 1,
          regressionBreaches: 0,
          expiredClassificationBreaches: 0,
          totalBreaches: 1,
        },
        diagnostics: [],
      },
    });

    const json = serializedSafe(auditResult);
    expect(json).toContain("\"sourceMapping\"");
    expect(json).toContain("\"recommendations\"");
    expect(json).toContain("\"sourceAnalysis\"");

    const html = renderHtmlReport(auditResult);
    expect(html).toContain(EXPECTED_LOCATIONS.htmlSubmit.uri);
    expect(html).toContain(String(EXPECTED_LOCATIONS.htmlSubmit.line));
    expect(html).toContain("Automated recommendations do not establish WCAG conformance");
    expect(html).not.toContain("must-not-leak-from-script");
    serializedSafe(html);

    const sarifInput = createSarifInputFromAuditResult(auditResult);
    const sarif = generateSarif(sarifInput, { includeResolvedSummary: true });
    validateAgainstOfficialSchema(sarif.log);
    const mappedResult = sarif.log.runs[0]?.results?.find(
      (entry) => entry.partialFingerprints?.["a11ystFingerprint/v1"] === mapped?.fingerprint,
    );
    expect(mappedResult?.locations?.[0]?.physicalLocation?.artifactLocation.uri).toBe(
      EXPECTED_LOCATIONS.htmlSubmit.uri,
    );
    const ambiguousResult = sarif.log.runs[0]?.results?.find(
      (entry) => entry.partialFingerprints?.["a11ystFingerprint/v1"] === ambiguous?.fingerprint,
    );
    expect(ambiguousResult?.locations?.[0]?.physicalLocation).toBeUndefined();
    expect(ambiguousResult?.locations?.[0]?.logicalLocations?.[0]?.kind).toBe("route");

    const markdown = generateMarkdownReport(createMarkdownInputFromAuditResult(auditResult), {
      maxDetailedFindings: 50,
      includeKnownFindings: true,
    }).markdown;
    expect(markdown).toContain("Likely source:");
    expect(markdown).toContain(EXPECTED_LOCATIONS.htmlSubmit.uri);
    expect(markdown).toContain("Automated testing does not establish WCAG conformance");
    serializedSafe(markdown);

    const annotations = generateGitHubAnnotations(createGitHubAnnotationsInputFromAuditResult(auditResult));
    expect(annotations.commands).toContain(`file=${EXPECTED_LOCATIONS.htmlSubmit.uri}`);
    expect(annotations.commands).toContain(`line=${EXPECTED_LOCATIONS.htmlSubmit.line}`);
    expect(annotations.commands).not.toContain(`line=${EXPECTED_LOCATIONS.htmlAmbiguousPrimary.line}`);
    serializedSafe(annotations.commands);

    const junit = serializeJunit(generateJunit(createJunitInputFromAuditResult(auditResult)).document);
    expect(junit).toContain("<testsuite");
    expect(junit).not.toContain("sourceMapping");
    for (const marker of SENSITIVE_MARKERS) {
      expect(junit).not.toContain(marker);
    }

    const outputDir = await mkdtemp(join(tmpdir(), "a11yst-reporters-real-"));
    tempDirs.push(outputDir);
    const generated = await generateHtmlReport({ auditResult, outputDirectory: outputDir });
    const indexHtml = await readFile(generated.indexPath, "utf8");
    expect(indexHtml).toContain(EXPECTED_LOCATIONS.reactSubmit.uri);
    serializedSafe(indexHtml);
  });
});
