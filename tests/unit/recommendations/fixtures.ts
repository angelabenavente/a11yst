import type {
  AccessibilityRecommendationInput,
  SourceMappingCandidate,
  SourceMappingResult,
  SourceRankingResult,
} from "@a11yst/types";

function location(uri: string, line: number, column = 1): SourceMappingCandidate["location"] {
  return { uri, region: { start: { line, column } } };
}

function mappedResult(uri: string, line: number, confidence: SourceMappingCandidate["confidence"] = "high"): SourceMappingResult {
  const candidate: SourceMappingCandidate = {
    location: location(uri, line),
    confidence,
    provenance: "selector-match",
    signals: [{ kind: "selector", matched: true, value: "button#save" }],
    framework: "react",
    adapter: "react-static",
  };
  return { status: "mapped", selected: candidate, candidates: [candidate], diagnostics: [] };
}

function ambiguousMapping(uris: string[]): SourceMappingResult {
  const candidates = uris.map((uri, index) => ({
    location: location(uri, 10 + index),
    confidence: "high" as const,
    provenance: "selector-match" as const,
    signals: [{ kind: "selector" as const, matched: true, value: "button#save" }],
  }));
  return { status: "ambiguous", candidates, diagnostics: [] };
}

function rankedResolved(uri: string, line: number): SourceRankingResult {
  return {
    version: 1,
    status: "resolved",
    selected: {
      location: location(uri, line),
      representative: {
        location: location(uri, line),
        confidence: "high",
        provenance: "selector-match",
        signals: [{ kind: "selector", matched: true }],
      },
      supportingCandidates: [],
      score: 500,
      effectiveConfidence: "high",
      contributions: [],
    },
    ranked: [],
    diagnostics: [],
    decision: { minimumResolutionScore: 340, minimumWinningMargin: 60 },
  };
}

export function buttonNameHtmlMapped(): AccessibilityRecommendationInput {
  return {
    ruleId: "button-name",
    impact: "serious",
    element: { tagName: "button", accessibleName: "" },
    context: { framework: "html" },
    sourceMapping: mappedResult("apps/legacy/public/checkout.html", 42),
  };
}

export function buttonNameReactMapped(): AccessibilityRecommendationInput {
  return {
    ruleId: "button-name",
    element: { tagName: "button" },
    context: { framework: "react" },
    sourceMapping: mappedResult("apps/storefront/src/components/CheckoutButton.tsx", 18),
  };
}

export function buttonNameNextRanked(): AccessibilityRecommendationInput {
  return {
    ruleId: "button-name",
    element: { tagName: "button" },
    context: { framework: "nextjs", route: "/checkout" },
    sourceRanking: rankedResolved("apps/storefront/src/app/checkout/page.tsx", 27),
  };
}

export function linkNameVue(): AccessibilityRecommendationInput {
  return {
    ruleId: "link-name",
    element: { tagName: "a", visibleText: "" },
    context: { framework: "vue" },
    sourceMapping: mappedResult("apps/admin/src/components/NavLink.vue", 12),
  };
}

export function imageAltNuxt(): AccessibilityRecommendationInput {
  return {
    ruleId: "image-alt",
    element: { tagName: "img" },
    context: { framework: "nuxt" },
    sourceMapping: mappedResult("apps/admin/app/pages/product.vue", 8),
  };
}

export function labelAngularInline(): AccessibilityRecommendationInput {
  return {
    ruleId: "label",
    element: { tagName: "input" },
    context: { framework: "angular" },
    sourceMapping: mappedResult("apps/admin/src/app/inline.component.ts", 22),
  };
}

export function colorContrastUnmapped(): AccessibilityRecommendationInput {
  return {
    ruleId: "color-contrast",
    context: { route: "/checkout" },
    sourceMapping: { status: "unmapped", candidates: [], diagnostics: [] },
  };
}

export function headingOrderAmbiguous(): AccessibilityRecommendationInput {
  return {
    ruleId: "heading-order",
    sourceMapping: ambiguousMapping(["apps/a/Page.tsx", "apps/b/Page.tsx"]),
  };
}

export function rankingMappingConflict(): AccessibilityRecommendationInput {
  return {
    ruleId: "button-name",
    element: { tagName: "button" },
    sourceMapping: mappedResult("apps/a/Button.tsx", 10),
    sourceRanking: rankedResolved("apps/b/Button.tsx", 10),
  };
}

export function sensitiveInput(): AccessibilityRecommendationInput {
  return {
    ruleId: "button-name",
    message: "password=secret-token",
    element: { attributes: { value: "Password123!" } },
    sourceMapping: mappedResult("apps/a/Button.tsx", 1),
  };
}

export function hostileHelpUrl(): AccessibilityRecommendationInput {
  return {
    ruleId: "button-name",
    helpUrl: "javascript:alert(1)",
    sourceMapping: mappedResult("apps/a/Button.tsx", 1),
  };
}
