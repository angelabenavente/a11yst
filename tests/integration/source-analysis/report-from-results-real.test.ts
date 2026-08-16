import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runReport } from "@a11yst/cli";
import * as sourceAnalysis from "@a11yst/source-analysis";
import * as sourceIndex from "@a11yst/source-index";
import * as htmlCatalog from "@a11yst/source-mapping-html";
import * as recommendations from "@a11yst/recommendations";
import * as sourceRanking from "@a11yst/source-ranking";
import {
  buildAuditResultFromAnalysis,
  findingBuilders,
  representativeFindings,
  runRealAnalysis,
  serializedSafe,
} from "./fixtures.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  vi.restoreAllMocks();
});

async function withTempRoot<T>(prefix: string, run: (root: string, resultsPath: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), `a11yst-${prefix}-`));
  tempRoots.push(root);
  const resultsPath = join(root, "results.json");
  return run(root, resultsPath);
}

describe("report from stored enriched results", () => {
  it("generates reports without re-running source analysis", async () => {
    await withTempRoot("report-from-results", async (root, resultsPath) => {
      const analysis = await runRealAnalysis(representativeFindings(), {
        ranking: false,
        recommendations: true,
      });
      const auditResult = buildAuditResultFromAnalysis(analysis);
      const original = structuredClone(auditResult);
      await writeFile(resultsPath, `${JSON.stringify(auditResult, null, 2)}\n`, "utf8");

      const indexSpy = vi.spyOn(sourceIndex, "indexRepositorySources");
      const analyzeSpy = vi.spyOn(sourceAnalysis, "analyzeFindingSources");
      const htmlSpy = vi.spyOn(htmlCatalog, "createHtmlSourceCatalog");
      const rankSpy = vi.spyOn(sourceRanking, "rankSourceMappingCandidates");
      const recommendSpy = vi.spyOn(recommendations, "createAccessibilityRecommendations");

      const htmlOut = join(root, "report-html");
      const sarifOut = join(root, "report.sarif");
      const markdownOut = join(root, "report.md");
      const annotationsOut = join(root, "annotations.txt");
      const junitOut = join(root, "report.junit.xml");

      await runReport({ cwd: root, resultsPath, format: "html", output: htmlOut });
      await runReport({ cwd: root, resultsPath, format: "sarif", output: sarifOut });
      await runReport({ cwd: root, resultsPath, format: "markdown", output: markdownOut });
      await runReport({ cwd: root, resultsPath, format: "github-annotations", output: annotationsOut });
      await runReport({ cwd: root, resultsPath, format: "junit", output: junitOut });

      expect(indexSpy).not.toHaveBeenCalled();
      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(htmlSpy).not.toHaveBeenCalled();
      expect(rankSpy).not.toHaveBeenCalled();
      expect(recommendSpy).not.toHaveBeenCalled();

      const html = await readFile(join(htmlOut, "report", "index.html"), "utf8");
      const sarif = await readFile(sarifOut, "utf8");
      const markdown = await readFile(markdownOut, "utf8");
      const annotations = await readFile(annotationsOut, "utf8");
      const junit = await readFile(junitOut, "utf8");
      serializedSafe(html);
      serializedSafe(sarif);
      serializedSafe(markdown);
      serializedSafe(annotations);
      serializedSafe(junit);

      const stored = JSON.parse(await readFile(resultsPath, "utf8"));
      expect(stored).toEqual(original);
      expect(stored.findings.map((finding: { fingerprint: string }) => finding.fingerprint)).toEqual(
        original.findings.map((finding) => finding.fingerprint),
      );
    });
  });

  it("still renders legacy results without enrichment", async () => {
    await withTempRoot("legacy-results", async (root, resultsPath) => {
      const legacy = buildAuditResultFromAnalysis({
        findings: [findingBuilders.htmlSubmitMapped()],
        summary: {
          version: 1,
          status: "disabled",
          projects: 0,
          indexedFiles: 0,
          analyzedFindings: 0,
          mappedFindings: 0,
          ambiguousFindings: 0,
          unmappedFindings: 0,
          invalidFindings: 0,
          rankedFindings: 0,
          resolvedByRanking: 0,
          recommendedFindings: 0,
          manualReviewFindings: 0,
          unsupportedRecommendationFindings: 0,
          diagnostics: [],
        },
      });
      delete legacy.sourceAnalysis;
      for (const finding of legacy.findings) {
        delete finding.sourceMapping;
        delete finding.recommendations;
      }
      await writeFile(resultsPath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
      const markdownOut = join(root, "legacy.md");
      const result = await runReport({ cwd: root, resultsPath, format: "markdown", output: markdownOut });
      expect(result.status).toBe("generated");
      const markdown = await readFile(markdownOut, "utf8");
      expect(markdown).toContain("## Status");
    });
  });
});
