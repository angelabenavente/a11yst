import { describe, expect, it } from "vitest";
import {
  productMetadata,
  productIdentity,
  type AccessibilityProfile,
  type A11ystConfig,
  type AuditArtifactReferences,
  type AuditManifest,
  type AuditPlan,
  type AuditRequest,
  type AuditResult,
  type Diagnostic,
  type Finding,
  type NormalizedRoute,
  type NormalizedViewport,
  type Platform,
  type ProjectConfig,
  type RouteConfig,
  type Severity,
  type ViewportConfig,
  type WebFramework,
} from "@a11yst/types";

describe("@a11yst/types public contracts", () => {
  it("exports product identity", () => {
    expect(productMetadata.name).toBe("a11yst");
    expect(productMetadata.displayName).toBe("a11yst");
    expect(productMetadata.command).toBe("a11yst");
    expect(productMetadata.tagline).toBe("Your accessibility analyst.");
  });

  it("exports structured productIdentity for documentation surfaces", () => {
    expect(productIdentity.productName).toBe("a11yst");
    expect(productIdentity.displayName).toBe("a11yst");
    expect(productIdentity.cliName).toBe("a11yst");
    expect(productIdentity.tagline).toBe("Your accessibility analyst.");
    expect("mascotName" in productIdentity).toBe(false);
    expect("supportingTagline" in productIdentity).toBe(false);
  });

  it("allows constructing the primary contracts", () => {
    const platform: Platform = "web";
    const framework: WebFramework = "react";
    const profile: AccessibilityProfile = "keyboard";
    const severity: Severity = "high";

    const route: RouteConfig = { path: "/" };
    const viewport: ViewportConfig = {
      name: "desktop",
      width: 1440,
      height: 900,
    };
    const normalizedRoute: NormalizedRoute = {
      id: "root",
      name: "Home",
      path: "/",
    };
    const normalizedViewport: NormalizedViewport = {
      ...viewport,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      orientation: "landscape",
    };

    const project: ProjectConfig = {
      name: "website",
      platform,
      framework,
      baseUrl: "http://localhost:3000",
      routes: [route],
      profiles: [profile],
      viewports: [viewport],
    };

    const config: A11ystConfig = { projects: [project] };
    const artifacts: AuditArtifactReferences = {
      outputDirectory: ".a11yst/results/runs/audit-1",
      manifestPath: ".a11yst/results/runs/audit-1/manifest.json",
      resultsPath: ".a11yst/results/runs/audit-1/results.json",
      latestPath: ".a11yst/results/latest.json",
    };
    const manifest: AuditManifest = {
      schemaVersion: "1",
      auditId: "audit-1",
      createdAt: new Date().toISOString(),
      status: "completed",
      productVersion: productMetadata.version,
      projectRoot: ".",
      resultsPath: "results.json",
      projects: [
        { name: "website", platform: "web", framework: "react" },
      ],
      artifactCounts: { screenshots: 1, findings: 1, runs: 1 },
    };

    const request: AuditRequest = {
      id: "web::website::react::keyboard::/::desktop",
      projectName: "website",
      platform,
      framework,
      profile,
      route,
      viewport,
      baseUrl: "http://localhost:3000",
    };

    const finding: Finding = {
      id: "f1",
      fingerprint: "fp1",
      source: "axe",
      ruleId: "button-name",
      title: "Buttons must have an accessible name.",
      severity,
      projectName: "website",
      profile,
      target: ["button"],
      standards: ["wcag2a"],
    };

    const diagnostic: Diagnostic = {
      code: "ENGINE_NOT_ENABLED",
      severity: "info",
      message: "Engine not enabled",
    };

    const result: AuditResult = {
      requestId: request.id,
      status: "planned",
      findings: [finding],
      diagnostics: [diagnostic],
    };

    const plan: AuditPlan = {
      projects: [],
      runs: [],
      totalRuns: 0,
      diagnostics: [diagnostic],
      createdAt: new Date().toISOString(),
    };

    expect(config.projects).toHaveLength(1);
    expect(normalizedRoute.id).toBe("root");
    expect(normalizedViewport.deviceScaleFactor).toBe(1);
    expect(artifacts.resultsPath).toContain("results.json");
    expect(manifest.artifactCounts.runs).toBe(1);
    expect(result.status).toBe("planned");
    expect(plan.totalRuns).toBe(0);
  });
});
