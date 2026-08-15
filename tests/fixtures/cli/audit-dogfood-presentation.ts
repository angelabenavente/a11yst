import type { AuditExecutionResult, Finding, AccessibilityRecommendation } from "@a11yst/types";

function minimalRecommendation(
  overrides: Partial<AccessibilityRecommendation> & Pick<AccessibilityRecommendation, "id" | "ruleId" | "title" | "summary">,
): AccessibilityRecommendation {
  return {
    status: "recommended",
    applicability: "high",
    rationale: overrides.summary,
    target: { status: "source" },
    actions: [],
    verification: [],
    examples: [],
    caveats: [],
    ...overrides,
  };
}

function linkFinding(index: number): Finding {
  return {
    id: `link-name-${index}`,
    fingerprint: `link-name|demo|/|default|desktop|a:nth-child(${index})`,
    source: "axe",
    ruleId: "link-name",
    title: "Links must have discernible text",
    description: "Element has no discernible text for link purpose.",
    severity: "high",
    route: "/",
    projectName: "demo",
    profile: "default",
    viewport: "desktop",
    target: [`a.social-link-${index}`],
    standards: ["wcag2a"],
    sourceMapping: {
      status: "mapped",
      candidates: [],
      diagnostics: [],
      selected: {
        adapter: "react",
        confidence: "high",
        location: {
          uri: "src/components/SocialLinks.jsx",
          language: "jsx",
          region: {
            start: { line: 18, column: 5 + index },
            end: { line: 18, column: 10 + index },
          },
        },
        provenance: "selector-match",
        signals: [],
      },
    },
    recommendations: {
      version: 1,
      status: "recommended",
      recommendations: [
        minimalRecommendation({
          id: "link-name-text",
          ruleId: "link-name",
          title: "Provide visible link text or aria-label",
          summary:
            "Ensure each social link exposes an accessible name via visible text or aria-label.",
        }),
      ],
      diagnostics: [],
    },
  };
}

function selectFinding(): Finding {
  return {
    id: "select-name-1",
    fingerprint: "select-name|demo|/settings|default|desktop|#language",
    source: "axe",
    ruleId: "select-name",
    title: "Select element must have an accessible name",
    description: "Form element does not have an associated label.",
    severity: "critical",
    route: "/settings",
    projectName: "demo",
    profile: "default",
    viewport: "desktop",
    target: ["#language"],
    standards: ["wcag2a"],
    sourceMapping: {
      status: "mapped",
      candidates: [],
      diagnostics: [],
      selected: {
        adapter: "react",
        confidence: "high",
        location: {
          uri: "src/components/LanguageSelector.jsx",
          language: "jsx",
          region: {
            start: { line: 24, column: 7 },
            end: { line: 24, column: 7 },
          },
        },
        provenance: "selector-match",
        signals: [],
      },
    },
    recommendations: {
      version: 1,
      status: "recommended",
      recommendations: [
        minimalRecommendation({
          id: "select-label",
          ruleId: "select-name",
          title: "Associate a label with the select",
          summary: "Use a visible <label> or aria-label on the language selector.",
        }),
      ],
      diagnostics: [],
    },
  };
}

/** Dogfood-like audit result: 1 critical select-name, 5 high link-name. */
export function createAuditDogfoodFixture(
  overrides: Partial<AuditExecutionResult> = {},
): AuditExecutionResult {
  const findings: Finding[] = [selectFinding(), ...Array.from({ length: 5 }, (_, i) => linkFinding(i + 1))];

  const base: AuditExecutionResult = {
    schemaVersion: "1",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: "2026-08-11T12:00:00.000Z",
      durationMs: 2500,
      plannedRuns: 2,
      completedRuns: 2,
      skippedRuns: 0,
      failedRuns: 0,
      findingCount: 6,
      findingsBySeverity: {
        critical: 1,
        high: 5,
        medium: 0,
        minor: 0,
      },
    },
    plan: {
      projects: [
        {
          name: "demo",
          rootDir: "/project",
          platform: "web",
          framework: "react",
          adapterId: "react",
          baseUrl: "http://127.0.0.1:5173",
          routes: [],
          routeDiscovery: { mode: "fallback", include: [], exclude: [], samples: {} },
          readiness: { waitUntil: "domcontentloaded" },
          profiles: ["default"],
          profileOptions: [],
          viewports: [],
          flows: [],
        },
      ],
      runs: [],
      totalRuns: 2,
      diagnostics: [],
      createdAt: "2026-08-11T12:00:00.000Z",
    },
    runs: [
      {
        runId: "run-settings",
        projectName: "demo",
        platform: "web",
        framework: "react",
        route: "/settings",
        url: "http://127.0.0.1:5173/settings",
        profile: "default",
        viewport: { name: "desktop", width: 1280, height: 720 },
        status: "completed",
        startedAt: "2026-08-11T12:00:01.000Z",
        durationMs: 900,
        findings: [findings[0]!],
        diagnostics: [],
      },
      {
        runId: "run-home",
        projectName: "demo",
        platform: "web",
        framework: "react",
        route: "/",
        url: "http://127.0.0.1:5173/",
        profile: "default",
        viewport: { name: "desktop", width: 1280, height: 720 },
        status: "completed",
        startedAt: "2026-08-11T12:00:02.000Z",
        durationMs: 1100,
        findings: findings.slice(1),
        diagnostics: [],
      },
    ],
    findings,
    diagnostics: [],
    limitations: [],
    environment: {
      product: "a11yst",
      productVersion: "0.1.0",
      nodeVersion: "20.0.0",
      browser: "chromium",
      headed: false,
    },
  };

  return { ...base, ...overrides };
}

export function createAuditExecutionFailedFixture(): AuditExecutionResult {
  return {
    ...createAuditDogfoodFixture(),
    status: "failed",
    summary: {
      ...createAuditDogfoodFixture().summary,
      status: "failed",
      failedRuns: 1,
      completedRuns: 1,
    },
    runs: [
      ...createAuditDogfoodFixture().runs,
      {
        runId: "run-broken",
        projectName: "demo",
        platform: "web",
        framework: "react",
        route: "/broken",
        profile: "default",
        viewport: { name: "desktop", width: 1280, height: 720 },
        status: "failed",
        startedAt: "2026-08-11T12:00:03.000Z",
        durationMs: 200,
        findings: [],
        diagnostics: [{ code: "navigation-timeout", severity: "error", message: "Page did not load" }],
      },
    ],
  };
}
