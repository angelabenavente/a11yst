import { describe, expect, it, vi } from "vitest";
import * as sourceIndex from "@a11yst/source-index";
import * as htmlCatalog from "@a11yst/source-mapping-html";
import * as reactCatalog from "@a11yst/source-mapping-react";
import * as nextCatalog from "@a11yst/source-mapping-next";
import * as vueCatalog from "@a11yst/source-mapping-vue";
import * as nuxtCatalog from "@a11yst/source-mapping-nuxt";
import * as angularCatalog from "@a11yst/source-mapping-angular";
import {
  EXPECTED_LOCATIONS,
  PARTIAL_PROJECTS,
  findingBuilders,
  representativeFindings,
  runPartialAnalysis,
  runRealAnalysis,
  expectExactExisting,
  expectMappedLocation,
  serializedSafe,
} from "./fixtures.js";

describe("real framework source analysis", () => {
  it("maps each framework using real index, catalogs, and mappers", async () => {
    const indexSpy = vi.spyOn(sourceIndex, "indexRepositorySources");
    const inputFindings = [
      findingBuilders.htmlSubmitMapped(),
      findingBuilders.reactSubmitMapped(),
      findingBuilders.nextCheckoutMapped(),
      findingBuilders.vueDialogMapped(),
      findingBuilders.nuxtCheckoutMapped(),
      findingBuilders.angularExternalMapped(),
      findingBuilders.angularInlineMapped(),
      findingBuilders.existingExact(),
    ];
    const original = structuredClone(inputFindings);
    const result = await runRealAnalysis(inputFindings, { ranking: false, recommendations: true });

    expect(indexSpy).toHaveBeenCalledTimes(1);
    expect(inputFindings).toEqual(original);

    expectMappedLocation(result.findings.find((f) => f.id === "html-submit"), EXPECTED_LOCATIONS.htmlSubmit, "high");
    expectMappedLocation(result.findings.find((f) => f.id === "react-submit"), EXPECTED_LOCATIONS.reactSubmit, "high");
    expectMappedLocation(result.findings.find((f) => f.id === "next-checkout"), EXPECTED_LOCATIONS.nextCheckout, "high");
    expectMappedLocation(result.findings.find((f) => f.id === "vue-dialog"), EXPECTED_LOCATIONS.vueDialogClose, "high");
    expectMappedLocation(result.findings.find((f) => f.id === "nuxt-checkout"), EXPECTED_LOCATIONS.nuxtCheckout, "high");
    expectMappedLocation(result.findings.find((f) => f.id === "angular-external"), EXPECTED_LOCATIONS.angularExternalSubmit, "high");
    expectMappedLocation(result.findings.find((f) => f.id === "angular-inline"), EXPECTED_LOCATIONS.angularInlineClose, "high");
    expectExactExisting(result.findings.find((f) => f.id === "existing-exact"));

    expect(["complete", "partial"]).toContain(result.summary.status);
    expect(result.summary.mappedFindings).toBeGreaterThanOrEqual(8);
    serializedSafe(result.summary);
    indexSpy.mockRestore();
  });

  it("indexes once and memoizes catalogs across frameworks", async () => {
    const indexSpy = vi.spyOn(sourceIndex, "indexRepositorySources");
    const htmlSpy = vi.spyOn(htmlCatalog, "createHtmlSourceCatalog");
    const reactSpy = vi.spyOn(reactCatalog, "createReactSourceCatalog");
    const nextSpy = vi.spyOn(nextCatalog, "createNextRouteCatalog");
    const vueSpy = vi.spyOn(vueCatalog, "createVueSourceCatalog");
    const nuxtSpy = vi.spyOn(nuxtCatalog, "createNuxtRouteCatalog");
    const angularSpy = vi.spyOn(angularCatalog, "createAngularSourceCatalog");

    await runRealAnalysis(representativeFindings(), { ranking: false, recommendations: false });

    expect(indexSpy).toHaveBeenCalledTimes(1);
    expect(htmlSpy.mock.calls.length).toBeGreaterThan(0);
    expect(reactSpy.mock.calls.length).toBeGreaterThan(0);
    expect(nextSpy.mock.calls.length).toBeGreaterThan(0);
    expect(vueSpy.mock.calls.length).toBeGreaterThan(0);
    expect(nuxtSpy.mock.calls.length).toBeGreaterThan(0);
    expect(angularSpy.mock.calls.length).toBeGreaterThan(0);
    const htmlScopeKeys = new Set(htmlSpy.mock.calls.map((call) => JSON.stringify(call[0]?.scopeIds ?? [])));
    expect(htmlScopeKeys.size).toBeLessThanOrEqual(2);

    indexSpy.mockRestore();
    htmlSpy.mockRestore();
    reactSpy.mockRestore();
    nextSpy.mockRestore();
    vueSpy.mockRestore();
    nuxtSpy.mockRestore();
    angularSpy.mockRestore();
  });

  it("leaves dynamic bindings unmapped", async () => {
    const result = await runRealAnalysis(
      [
        findingBuilders.reactDynamicUnmapped(),
        findingBuilders.vueDynamicUnmapped(),
        findingBuilders.angularDynamicUnmapped(),
      ],
      { ranking: false, recommendations: true },
    );
    for (const finding of result.findings) {
      expect(finding.sourceMapping?.status).toBe("unmapped");
      expect(finding.sourceMapping?.selected).toBeUndefined();
    }
  });

  it("respects disabled, ranking-disabled, and recommendations-disabled options", async () => {
    const disabled = await runRealAnalysis([findingBuilders.htmlSubmitMapped()], {
      enabled: false,
    });
    expect(disabled.summary.status).toBe("disabled");
    expect(disabled.findings[0]?.sourceMapping).toBeUndefined();

    const noRanking = await runRealAnalysis([findingBuilders.htmlAmbiguous()], {
      ranking: false,
      recommendations: true,
    });
    expect(noRanking.findings[0]?.sourceMapping?.status).toBe("ambiguous");
    expect(noRanking.findings[0]?.sourceRanking).toBeUndefined();

    const noRecommendations = await runRealAnalysis([findingBuilders.htmlSubmitMapped()], {
      ranking: true,
      recommendations: false,
    });
    expect(noRecommendations.findings[0]?.sourceMapping).toBeDefined();
    expect(noRecommendations.findings[0]?.recommendations).toBeUndefined();
  });

  it("does not change finding fingerprints", async () => {
    const findings = representativeFindings();
    const expected = findings.map((finding) => finding.fingerprint);
    const result = await runRealAnalysis(findings, { ranking: true, recommendations: true });
    expect(result.findings.map((finding) => finding.fingerprint)).toEqual(expected);
  });

  it("fails soft on malformed React while keeping HTML mapped", async () => {
    const result = await runPartialAnalysis(
      [findingBuilders.partialHtmlSubmitMapped(), findingBuilders.reactSubmitMapped()],
      { ranking: false, recommendations: false },
    );
    expect(result.summary.status).toBe("partial");
    expectMappedLocation(
      result.findings.find((f) => f.id === "partial-html-submit"),
      EXPECTED_LOCATIONS.partialHtmlSubmit,
      "high",
    );
    expect(JSON.stringify(result.summary)).not.toContain("stack");
    expect(JSON.stringify(result.summary)).not.toContain(PARTIAL_PROJECTS[0]?.rootUri ?? "");
  });
});
