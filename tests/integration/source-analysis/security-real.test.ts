import { describe, expect, it } from "vitest";
import { createGitHubAnnotationsInputFromAuditResult, createJunitInputFromAuditResult, createMarkdownInputFromAuditResult, createSarifInputFromAuditResult } from "@a11yst/core";
import { generateJunit, serializeJunit } from "@a11yst/junit";
import { generateGitHubAnnotations, generateMarkdownReport, renderHtmlReport } from "@a11yst/reporters";
import { generateSarif, serializeSarif } from "@a11yst/sarif";
import {
  REAL_MONOREPO_ROOT,
  SENSITIVE_MARKERS,
  buildAuditResultFromAnalysis,
  enrichmentPayload,
  findingBuilders,
  representativeFindings,
  runRealAnalysis,
} from "./fixtures.js";

function assertNoSensitiveLeak(text: string): void {
  expect(text).not.toContain(REAL_MONOREPO_ROOT);
  expect(text).not.toContain(".next");
  expect(text).not.toContain(".nuxt");
  expect(text).not.toContain("export function CheckoutButton");
  expect(text).not.toContain("<template>");
  expect(text).not.toContain("must-not-leak-from-script");
  for (const marker of SENSITIVE_MARKERS) {
    if (marker === "must-not-leak-from-script") {
      continue;
    }
    expect(text).not.toContain(marker);
  }
}

describe("security on real source analysis outputs", () => {
  it("does not leak fixture secrets or source code into serialized outputs", async () => {
    const analysis = await runRealAnalysis(
      [...representativeFindings(), findingBuilders.sensitiveFinding()],
      { ranking: false, recommendations: true },
    );

    assertNoSensitiveLeak(JSON.stringify(enrichmentPayload(analysis)));
    assertNoSensitiveLeak(JSON.stringify(analysis.summary));
    assertNoSensitiveLeak(JSON.stringify(analysis.summary.diagnostics));

    const sensitive = analysis.findings.find((finding) => finding.id === "sensitive-finding");
    expect(JSON.stringify(sensitive?.sourceMapping)).not.toContain(SENSITIVE_MARKERS[0]);
    expect(JSON.stringify(sensitive?.recommendations)).not.toContain(SENSITIVE_MARKERS[0]);
    expect(JSON.stringify(sensitive?.recommendations)).not.toContain(SENSITIVE_MARKERS[3]);
    expect(JSON.stringify(sensitive?.recommendations)).not.toContain(SENSITIVE_MARKERS[5]);

    const reportAudit = buildAuditResultFromAnalysis({
      findings: analysis.findings.filter((finding) => finding.id !== "sensitive-finding"),
      summary: analysis.summary,
    });

    const html = renderHtmlReport(reportAudit);
    const sarif = serializeSarif(generateSarif(createSarifInputFromAuditResult(reportAudit)).log);
    const markdown = generateMarkdownReport(createMarkdownInputFromAuditResult(reportAudit)).markdown;
    const annotations = generateGitHubAnnotations(createGitHubAnnotationsInputFromAuditResult(reportAudit)).commands;
    const junit = serializeJunit(generateJunit(createJunitInputFromAuditResult(reportAudit)).document);

    for (const output of [html, sarif, markdown, annotations, junit]) {
      assertNoSensitiveLeak(output);
    }
  });
});
