import { describe, expect, it } from "vitest";
import { rankSourceMappingCandidates } from "@a11yst/source-ranking";
import { applyRanking } from "@a11yst/source-analysis";
import {
  EXPECTED_LOCATIONS,
  REAL_PROJECTS,
  findingBuilders,
  runRealAnalysis,
  expectExactExisting,
  expectMappedLocation,
} from "./fixtures.js";

describe("ambiguity and ranking on real fixtures", () => {
  it("keeps HTML duplicate selectors ambiguous without selecting the first candidate", async () => {
    const result = await runRealAnalysis([findingBuilders.htmlAmbiguous()], {
      ranking: false,
      recommendations: false,
    });
    const finding = result.findings[0];
    expect(finding?.sourceMapping?.status).toBe("ambiguous");
    expect(finding?.sourceMapping?.selected).toBeUndefined();
    const lines = finding?.sourceMapping?.candidates.map((c) => c.location.region.start.line).sort();
    expect(lines).toEqual([
      EXPECTED_LOCATIONS.htmlAmbiguousPrimary.line,
      EXPECTED_LOCATIONS.htmlAmbiguousDuplicate.line,
    ]);
  });

  it("preserves near-tie ambiguity when ranking is enabled", async () => {
    const result = await runRealAnalysis([findingBuilders.htmlAmbiguous()], {
      ranking: true,
      recommendations: false,
    });
    const finding = result.findings[0];
    expect(finding?.sourceMapping?.selected).toBeUndefined();
    expect(finding?.sourceRanking?.status === "ambiguous" || finding?.sourceRanking?.status === "insufficient").toBe(true);
  });

  it("resolves clearly stronger real Next evidence over weaker medium evidence", async () => {
    const mapped = await runRealAnalysis([findingBuilders.nextSharedAmbiguous()], {
      ranking: false,
      recommendations: false,
    });
    const candidates = mapped.findings[0]?.sourceMapping?.candidates ?? [];
    const layout = candidates.find((candidate) => candidate.location.uri.includes("layout"));
    const page = candidates.find((candidate) => candidate.location.uri.includes("page"));
    expect(layout).toBeDefined();
    expect(page).toBeDefined();

    const weakerPage = {
      ...page!,
      confidence: "medium" as const,
      provenance: "text-match" as const,
      signals: [{ kind: "visible-text" as const, matched: true, value: "Continue checkout" }],
    };
    const ranked = rankSourceMappingCandidates({
      candidates: [weakerPage, layout!],
      context: { expectedFramework: "next", routePattern: "/checkout" },
    });
    expect(ranked.status).toBe("resolved");
    expect(ranked.selected?.location.uri).toBe(EXPECTED_LOCATIONS.nextLayoutShared.uri);

    const applied = applyRanking(
      { status: "ambiguous", candidates: [weakerPage, layout!], diagnostics: [] },
      { expectedFramework: "next", routePattern: "/checkout" },
    );
    expect(applied.mapping.status).toBe("mapped");
    expect(applied.ranking?.status).toBe("resolved");
  });

  it("uses exact existing source location and skips heuristic ranking elevation", async () => {
    const result = await runRealAnalysis([findingBuilders.existingExact()], {
      ranking: true,
      recommendations: false,
    });
    expectExactExisting(result.findings[0]);
    expect(result.findings[0]?.sourceRanking).toBeUndefined();
  });

  it("isolates shared selectors to the correct project scope", async () => {
    const reactOnly = await runRealAnalysis([findingBuilders.reactSharedSubmit()], {
      projects: REAL_PROJECTS.filter((p) => p.id === "react-store"),
      ranking: false,
      recommendations: false,
    });
    expectMappedLocation(reactOnly.findings[0], EXPECTED_LOCATIONS.reactSharedSubmit, "high");

    const vueOnly = await runRealAnalysis([findingBuilders.vueSharedSubmit()], {
      projects: REAL_PROJECTS.filter((p) => p.id === "vue-admin"),
      ranking: false,
      recommendations: false,
    });
    expectMappedLocation(vueOnly.findings[0], EXPECTED_LOCATIONS.vueSharedSubmit, "high");
  });

  it("does not pick the first project when project scope is missing", async () => {
    const finding = {
      ...findingBuilders.reactSharedSubmit(),
      id: "missing-project",
      fingerprint: "button-name|missing-project||default|desktop|button#shared-submit",
      projectName: "missing-project",
    };
    const result = await runRealAnalysis([finding], {
      ranking: true,
      recommendations: false,
    });
    expect(result.findings[0]?.sourceMapping?.selected).toBeUndefined();
    expect(result.findings[0]?.sourceMapping?.status).not.toBe("mapped");
  });

  it("returns insufficient for low-only evidence", async () => {
    const ranked = rankSourceMappingCandidates({
      candidates: [
        {
          location: { uri: "apps/react-store/src/components/DynamicButton.tsx", region: { start: { line: 3 } } },
          confidence: "low",
          provenance: "text-match",
          signals: [{ kind: "visible-text", matched: true, value: "Pay" }],
        },
      ],
      context: { expectedFramework: "react" },
    });
    expect(ranked.status).toBe("insufficient");
  });

  it("does not increase confidence during ranking", async () => {
    const result = await runRealAnalysis([findingBuilders.htmlSubmitMapped()], {
      ranking: true,
      recommendations: false,
    });
    const confidence = result.findings[0]?.sourceMapping?.selected?.confidence;
    expect(confidence).toBe("high");
    expect(confidence).not.toBe("exact");
  });
});
