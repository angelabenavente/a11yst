import type {
  AuditExecutionResult,
  AuditRunResult,
  BaselineEntry,
  BaselineFile,
  Finding,
  FindingClassification,
  ResolvedWebProject,
} from "@a11yst/types";
import type { Clock } from "@a11yst/baseline";

export const FIXED_NOW = "2026-08-04T12:00:00.000Z";
export const FIXED_CALENDAR = "2026-08-04";
export const FUTURE_CALENDAR = "2099-12-31";
export const PAST_CALENDAR = "2020-01-01";

export function fixedClock(iso = FIXED_NOW): Clock {
  const instant = new Date(iso);
  return {
    now(): Date {
      return new Date(instant.getTime());
    },
  };
}

export function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "rule|website|/|default|desktop|#target",
    fingerprint: "rule|website|/|default|desktop|#target",
    fingerprintVersion: "1",
    source: "axe",
    ruleId: "rule",
    title: "Example finding",
    severity: "medium",
    projectName: "website",
    profile: "default",
    route: "/",
    viewport: "desktop",
    target: ["#target"],
    standards: [],
    ...overrides,
  };
}

export function flowFinding(overrides: Partial<Finding> = {}): Finding {
  return finding({
    id: "dialog-focus::website::checkout::step-open::default::desktop::#open",
    fingerprint: "dialog-focus::website::checkout::step-open::default::desktop::#open",
    source: "a11yst",
    ruleId: "dialog-focus",
    flowId: "checkout",
    checkpointId: "step-open",
    route: undefined,
    ...overrides,
  });
}

export function baselineEntry(overrides: Partial<BaselineEntry> = {}): BaselineEntry {
  return {
    fingerprint: "rule|website|/|default|desktop|#target",
    fingerprintVersion: "1",
    ruleId: "rule",
    source: "axe",
    projectName: "website",
    location: {
      kind: "route",
      route: "/",
      profile: "default",
      viewport: "desktop",
    },
    severity: "medium",
    firstSeenAt: FIXED_NOW,
    lastSeenAt: FIXED_NOW,
    snapshot: {
      title: "Example finding",
      profile: "default",
      route: "/",
      viewport: "desktop",
    },
    ...overrides,
  };
}

export function baselineFile(overrides: Partial<BaselineFile> = {}): BaselineFile {
  return {
    schemaVersion: "1",
    fingerprintVersion: "1",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    productVersion: "1.0.0",
    entries: [],
    ...overrides,
  };
}

export function classification(
  overrides: Partial<FindingClassification> = {},
): FindingClassification {
  return {
    disposition: "false-positive",
    reason: "Documented exception for fixture.",
    createdAt: FIXED_NOW,
    scope: {
      type: "finding",
      fingerprint: "rule|website|/|default|desktop|#target",
    },
    ...overrides,
  };
}

export function run(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return {
    runId: "run-1",
    projectName: "website",
    platform: "web",
    framework: "html",
    profile: "default",
    status: "completed",
    startedAt: FIXED_NOW,
    durationMs: 10,
    route: "/",
    viewport: { name: "desktop", width: 1440, height: 900 },
    findings: [],
    diagnostics: [],
    ...overrides,
  };
}

export function flowRun(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return run({
    runId: "flow-run-1",
    kind: "flow-checkpoint",
    route: undefined,
    flowId: "checkout",
    checkpointId: "step-open",
    ...overrides,
  });
}

function webProject(overrides: Partial<ResolvedWebProject> = {}): ResolvedWebProject {
  return {
    name: "website",
    rootDir: ".",
    platform: "web",
    framework: "html",
    adapterId: "html",
    baseUrl: "http://localhost:3000/",
    routes: [{ id: "home", name: "Home", path: "/", origin: "explicit" }],
    routeDiscovery: { mode: "fallback", include: [], exclude: [], samples: {} },
    readiness: { waitUntil: "domcontentloaded" },
    profiles: ["default"],
    profileOptions: [{ id: "default" }],
    viewports: [
      {
        name: "desktop",
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        orientation: "landscape",
      },
    ],
    flows: [],
    ...overrides,
  };
}

export function auditResult(overrides: Partial<AuditExecutionResult> = {}): AuditExecutionResult {
  return {
    schemaVersion: "1",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: FIXED_NOW,
      durationMs: 100,
      plannedRuns: 1,
      completedRuns: 1,
      skippedRuns: 0,
      failedRuns: 0,
      findingCount: 0,
      findingsBySeverity: {
        critical: 0,
        high: 0,        medium: 0,
        minor: 0,
      },
    },
    plan: {
      projects: [webProject()],
      runs: [],
      totalRuns: 0,
      diagnostics: [],
      createdAt: FIXED_NOW,
    },
    runs: [],
    findings: [],
    diagnostics: [],
    limitations: [],
    environment: {
      product: "a11yst",
      productVersion: "1.0.0",
      nodeVersion: "20.0.0",
      headed: false,
    },
    ...overrides,
  };
}
