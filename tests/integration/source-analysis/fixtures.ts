import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import type { AuditExecutionResult, Finding, SourceAnalysisProject } from "@a11yst/types";
import { analyzeFindingSources, type SourceAnalysisResult } from "@a11yst/source-analysis";
import { EXPECTED_LOCATIONS, SENSITIVE_MARKERS } from "./expected-locations.js";

export const REAL_MONOREPO_ROOT = resolve(
  fileURLToPath(new URL("../../fixtures/source-analysis/real-monorepo", import.meta.url)),
);

export const PARTIAL_MONOREPO_ROOT = resolve(
  fileURLToPath(new URL("../../fixtures/source-analysis/partial-monorepo", import.meta.url)),
);

export const PARTIAL_PROJECTS: SourceAnalysisProject[] = [
  { id: "legacy-html", rootUri: "apps/legacy-html", projectName: "legacy-html", framework: "html" },
  { id: "broken-react", rootUri: "apps/broken-react", projectName: "broken-react", framework: "react" },
];

export const REAL_PROJECTS: SourceAnalysisProject[] = [
  { id: "legacy-html", rootUri: "apps/legacy-html", projectName: "legacy-html", framework: "html" },
  { id: "react-store", rootUri: "apps/react-store", projectName: "react-store", framework: "react" },
  { id: "next-store", rootUri: "apps/next-store", projectName: "next-store", framework: "next" },
  { id: "vue-admin", rootUri: "apps/vue-admin", projectName: "vue-admin", framework: "vue" },
  { id: "nuxt-admin", rootUri: "apps/nuxt-admin", projectName: "nuxt-admin", framework: "nuxt" },
  { id: "angular-admin", rootUri: "apps/angular-admin", projectName: "angular-admin", framework: "angular" },
];

export { EXPECTED_LOCATIONS, SENSITIVE_MARKERS };

function baseFinding(overrides: Partial<Finding> & Pick<Finding, "id" | "fingerprint" | "ruleId" | "projectName" | "target">): Finding {
  return {
    source: "axe",
    title: "Accessibility issue",
    severity: "high",
    profile: "default",
    viewport: "desktop",
    standards: ["wcag2a"],
    ...overrides,
  };
}

export const findingBuilders = {
  htmlSubmitMapped: () =>
    baseFinding({
      id: "html-submit",
      fingerprint: "button-name|legacy-html|/checkout|default|desktop|button#submit-order",
      ruleId: "button-name",
      projectName: "legacy-html",
      route: "/checkout",
      target: ["button#submit-order"],
    }),
  htmlAmbiguous: () =>
    baseFinding({
      id: "html-ambiguous",
      fingerprint: "button-name|legacy-html|/checkout|default|desktop|button.primary.action",
      ruleId: "button-name",
      projectName: "legacy-html",
      route: "/checkout",
      target: ["button.primary.action"],
    }),
  htmlImageAlt: () =>
    baseFinding({
      id: "html-image",
      fingerprint: "image-alt|legacy-html|/checkout|default|desktop|img",
      ruleId: "image-alt",
      projectName: "legacy-html",
      route: "/checkout",
      target: ["img"],
    }),
  reactSubmitMapped: () =>
    baseFinding({
      id: "react-submit",
      fingerprint: "button-name|react-store||default|desktop|button#react-submit-order",
      ruleId: "button-name",
      projectName: "react-store",
      target: ["button#react-submit-order"],
    }),
  reactDynamicUnmapped: () =>
    baseFinding({
      id: "react-dynamic",
      fingerprint: "button-name|react-store||default|desktop|button#dynamic-pay",
      ruleId: "button-name",
      projectName: "react-store",
      target: ["button#dynamic-pay"],
    }),
  reactSharedSubmit: () =>
    baseFinding({
      id: "react-shared",
      fingerprint: "button-name|react-store||default|desktop|button#shared-submit",
      ruleId: "button-name",
      projectName: "react-store",
      target: ["button#shared-submit"],
    }),
  nextCheckoutMapped: () =>
    baseFinding({
      id: "next-checkout",
      fingerprint: "button-name|next-store|/checkout|default|desktop|button#next-checkout-submit",
      ruleId: "button-name",
      projectName: "next-store",
      route: "/checkout",
      target: ["button#next-checkout-submit"],
    }),
  nextSharedAmbiguous: () =>
    baseFinding({
      id: "next-shared",
      fingerprint: "button-name|next-store|/checkout|default|desktop|button#next-shared-action",
      ruleId: "button-name",
      projectName: "next-store",
      route: "/checkout?step=payment#dialog",
      target: ["button#next-shared-action"],
    }),
  nextLoadingUnmapped: () =>
    baseFinding({
      id: "next-loading",
      fingerprint: "button-name|next-store|/checkout|default|desktop|button#next-loading-only",
      ruleId: "button-name",
      projectName: "next-store",
      route: "/checkout",
      target: ["button#next-loading-only"],
    }),
  vueDialogMapped: () =>
    baseFinding({
      id: "vue-dialog",
      fingerprint: "aria-dialog-name|vue-admin||default|desktop|button#close-dialog",
      ruleId: "aria-dialog-name",
      projectName: "vue-admin",
      target: ["button#close-dialog"],
    }),
  vueDynamicUnmapped: () =>
    baseFinding({
      id: "vue-dynamic",
      fingerprint: "button-name|vue-admin||default|desktop|button#dynamic-pay",
      ruleId: "button-name",
      projectName: "vue-admin",
      target: ["button#dynamic-pay"],
    }),
  vueSharedSubmit: () =>
    baseFinding({
      id: "vue-shared",
      fingerprint: "button-name|vue-admin||default|desktop|button#shared-submit",
      ruleId: "button-name",
      projectName: "vue-admin",
      target: ["button#shared-submit"],
    }),
  nuxtCheckoutMapped: () =>
    baseFinding({
      id: "nuxt-checkout",
      fingerprint: "button-name|nuxt-admin|/checkout|default|desktop|button#nuxt-checkout-submit",
      ruleId: "button-name",
      projectName: "nuxt-admin",
      route: "/checkout",
      target: ["button#nuxt-checkout-submit"],
    }),
  nuxtSharedAmbiguous: () =>
    baseFinding({
      id: "nuxt-shared",
      fingerprint: "button-name|nuxt-admin|/checkout|default|desktop|button#nuxt-shared-action",
      ruleId: "button-name",
      projectName: "nuxt-admin",
      route: "/checkout",
      target: ["button#nuxt-shared-action"],
    }),
  angularExternalMapped: () =>
    baseFinding({
      id: "angular-external",
      fingerprint: "button-name|angular-admin||default|desktop|button#angular-submit-order",
      ruleId: "button-name",
      projectName: "angular-admin",
      target: ["button#angular-submit-order"],
    }),
  angularInlineMapped: () =>
    baseFinding({
      id: "angular-inline",
      fingerprint: "button-name|angular-admin||default|desktop|button#inline-close",
      ruleId: "button-name",
      projectName: "angular-admin",
      target: ["button#inline-close"],
    }),
  angularDynamicUnmapped: () =>
    baseFinding({
      id: "angular-dynamic",
      fingerprint: "button-name|angular-admin||default|desktop|button#dynamic-pay",
      ruleId: "button-name",
      projectName: "angular-admin",
      target: ["button#dynamic-pay"],
    }),
  existingExact: () =>
    ({
      ...findingBuilders.reactSubmitMapped(),
      id: "existing-exact",
      fingerprint: "button-name|react-store||default|desktop|existing-exact",
      sourceLocation: {
        uri: EXPECTED_LOCATIONS.reactSubmit.uri,
        startLine: EXPECTED_LOCATIONS.reactSubmit.line,
        startColumn: EXPECTED_LOCATIONS.reactSubmit.column,
      },
    }) as Finding,
  unsupportedRule: () =>
    baseFinding({
      id: "unsupported-rule",
      fingerprint: "totally-unknown-rule|legacy-html|/checkout|default|desktop|main",
      ruleId: "totally-unknown-rule",
      projectName: "legacy-html",
      route: "/checkout",
      target: ["main"],
    }),
  sensitiveFinding: () =>
    baseFinding({
      id: "sensitive-finding",
      fingerprint: "button-name|legacy-html|/checkout|default|desktop|input[type=password]",
      ruleId: "button-name",
      projectName: "legacy-html",
      route: `/checkout?secret=${SENSITIVE_MARKERS[5]}`,
      target: ["input[type=password]"],
      message: `Authorization: ${SENSITIVE_MARKERS[3]}`,
      html: `<input type="password" value="${SENSITIVE_MARKERS[0]}">`,
    }),
  partialHtmlSubmitMapped: () =>
    baseFinding({
      id: "partial-html-submit",
      fingerprint: "button-name|legacy-html|/checkout|default|desktop|button#partial-submit",
      ruleId: "button-name",
      projectName: "legacy-html",
      route: "/checkout",
      target: ["button#partial-submit"],
    }),
};

export async function runRealAnalysis(
  findings: Finding[],
  options?: { ranking?: boolean; recommendations?: boolean; enabled?: boolean; projects?: SourceAnalysisProject[] },
): Promise<SourceAnalysisResult> {
  return analyzeFindingSources({
    repositoryRoot: REAL_MONOREPO_ROOT,
    projects: options?.projects ?? REAL_PROJECTS,
    findings,
    options: {
      enabled: options?.enabled ?? true,
      ranking: options?.ranking ?? true,
      recommendations: options?.recommendations ?? true,
    },
  });
}

export async function runPartialAnalysis(
  findings: Finding[],
  options?: { ranking?: boolean; recommendations?: boolean },
): Promise<SourceAnalysisResult> {
  return analyzeFindingSources({
    repositoryRoot: PARTIAL_MONOREPO_ROOT,
    projects: PARTIAL_PROJECTS,
    findings,
    options: {
      enabled: true,
      ranking: options?.ranking ?? true,
      recommendations: options?.recommendations ?? true,
    },
  });
}

export function representativeFindings(): Finding[] {
  return [
    findingBuilders.htmlSubmitMapped(),
    findingBuilders.htmlAmbiguous(),
    findingBuilders.htmlImageAlt(),
    findingBuilders.reactSubmitMapped(),
    findingBuilders.reactDynamicUnmapped(),
    findingBuilders.reactSharedSubmit(),
    findingBuilders.nextCheckoutMapped(),
    findingBuilders.nextSharedAmbiguous(),
    findingBuilders.nextLoadingUnmapped(),
    findingBuilders.vueDialogMapped(),
    findingBuilders.vueDynamicUnmapped(),
    findingBuilders.vueSharedSubmit(),
    findingBuilders.nuxtCheckoutMapped(),
    findingBuilders.nuxtSharedAmbiguous(),
    findingBuilders.angularExternalMapped(),
    findingBuilders.angularInlineMapped(),
    findingBuilders.existingExact(),
    findingBuilders.unsupportedRule(),
  ];
}

export function buildAuditResultFromAnalysis(
  analysis: SourceAnalysisResult,
  overrides?: Partial<AuditExecutionResult>,
): AuditExecutionResult {
  return {
    schemaVersion: "1",
    auditId: "audit-real-monorepo-10k",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: "2026-08-03T10:00:00.000Z",
      durationMs: 42,
      plannedRuns: 1,
      completedRuns: 1,
      failedRuns: 0,
      skippedRuns: 0,
      findingCount: analysis.findings.length,
      findingsBySeverity: {
        critical: 0,
        high: analysis.findings.length,
        medium: 0,
        minor: 0,
      },
    },
    plan: {
      projects: [],
      runs: [],
      totalRuns: 1,
      diagnostics: [],
      createdAt: "2026-08-03T10:00:00.000Z",
    },
    runs: [],
    findings: analysis.findings.map((finding) => ({
      ...finding,
      baseline: {
        status: "new",
        baselineFingerprint: finding.fingerprint,
        currentSeverity: finding.severity,
      },
    })),
    diagnostics: [],
    limitations: ["Automated checks do not establish conformance."],
    environment: {
      product: "a11yst",
      productVersion: "1.0.0",
      nodeVersion: "20.20.2",
      headed: false,
    },
    sourceAnalysis: analysis.summary,
    ...overrides,
  };
}

export function expectMappedLocation(
  finding: Finding | undefined,
  expected: { uri: string; line: number; column: number },
  confidence?: string,
) {
  expect(finding?.sourceMapping?.status).toBe("mapped");
  const selected = finding?.sourceMapping?.selected;
  expect(selected?.location.uri).toBe(expected.uri);
  expect(selected?.location.region.start.line).toBe(expected.line);
  expect(selected?.location.region.start.column).toBe(expected.column);
  if (confidence) {
    expect(selected?.confidence).toBe(confidence);
  }
  expect(selected?.confidence).not.toBe("exact");
}

export function expectExactExisting(finding: Finding | undefined) {
  expect(finding?.sourceMapping?.status).toBe("mapped");
  expect(finding?.sourceMapping?.selected?.confidence).toBe("exact");
  expect(finding?.sourceMapping?.selected?.provenance).toBe("existing-source-location");
}

export function serializedSafe(value: unknown, root = REAL_MONOREPO_ROOT): string {
  const text = JSON.stringify(value);
  expect(text).not.toContain(root);
  for (const marker of SENSITIVE_MARKERS) {
    if (marker === "must-not-leak-from-script") {
      expect(text).not.toContain(marker);
      continue;
    }
    expect(text).not.toContain(marker);
  }
  return text;
}

export function enrichmentPayload(analysis: SourceAnalysisResult): unknown {
  return {
    summary: analysis.summary,
    findings: analysis.findings.map((finding) => ({
      fingerprint: finding.fingerprint,
      sourceMapping: finding.sourceMapping,
      sourceRanking: finding.sourceRanking,
      recommendations: finding.recommendations,
    })),
  };
}
