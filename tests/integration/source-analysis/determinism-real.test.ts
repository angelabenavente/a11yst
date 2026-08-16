import { describe, expect, it } from "vitest";
import { createGitHubAnnotationsInputFromAuditResult, createMarkdownInputFromAuditResult, createSarifInputFromAuditResult } from "@a11yst/core";
import { generateGitHubAnnotations, generateMarkdownReport, renderHtmlReport } from "@a11yst/reporters";
import { generateSarif, serializeSarif } from "@a11yst/sarif";
import {
  REAL_PROJECTS,
  buildAuditResultFromAnalysis,
  representativeFindings,
  runRealAnalysis,
} from "./fixtures.js";

function reverseProjects() {
  return [...REAL_PROJECTS].reverse();
}

function reverseFindingAttributes(findings: ReturnType<typeof representativeFindings>) {
  return findings.map((finding) => ({
    ...finding,
    target: [...finding.target].reverse(),
    standards: [...finding.standards].reverse(),
  }));
}

describe("determinism on real source analysis fixtures", () => {
  it("produces identical enrichment and reports regardless of input ordering", async () => {
    const baselineFindings = representativeFindings();
    const baseline = await runRealAnalysis(baselineFindings, {
      ranking: true,
      recommendations: true,
    });

    const reversedProjects = await runRealAnalysis(baselineFindings, {
      projects: reverseProjects(),
      ranking: true,
      recommendations: true,
    });
    const reversedAttributes = await runRealAnalysis(reverseFindingAttributes(baselineFindings), {
      ranking: true,
      recommendations: true,
    });

    expect(reversedProjects.findings).toEqual(baseline.findings);
    expect(reversedProjects.summary).toEqual(baseline.summary);
    expect(reversedAttributes.findings).toEqual(baseline.findings);
    expect(reversedAttributes.summary).toEqual(baseline.summary);

    const auditResult = buildAuditResultFromAnalysis(baseline);
    const htmlA = renderHtmlReport(auditResult);
    const htmlB = renderHtmlReport(buildAuditResultFromAnalysis(reversedProjects));
    expect(htmlA).toBe(htmlB);

    const sarifA = serializeSarif(generateSarif(createSarifInputFromAuditResult(auditResult)).log);
    const sarifB = serializeSarif(
      generateSarif(createSarifInputFromAuditResult(buildAuditResultFromAnalysis(reversedProjects))).log,
    );
    expect(sarifA).toBe(sarifB);

    const markdownA = generateMarkdownReport(createMarkdownInputFromAuditResult(auditResult)).markdown;
    const markdownB = generateMarkdownReport(
      createMarkdownInputFromAuditResult(buildAuditResultFromAnalysis(reversedAttributes)),
    ).markdown;
    expect(markdownA).toBe(markdownB);

    const annotationsA = generateGitHubAnnotations(createGitHubAnnotationsInputFromAuditResult(auditResult)).commands;
    const annotationsB = generateGitHubAnnotations(
      createGitHubAnnotationsInputFromAuditResult(buildAuditResultFromAnalysis(reversedProjects)),
    ).commands;
    expect(annotationsA).toBe(annotationsB);
  });
});
