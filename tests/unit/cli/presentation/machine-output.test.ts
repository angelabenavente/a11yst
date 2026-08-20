import { describe, expect, it } from "vitest";
import { formatAuditHuman, formatAuditJson } from "@a11yst/cli";
import {
  formatDoctorHuman,
  formatDoctorJson,
  type DoctorReport,
} from "../../../../packages/cli/src/commands/doctor.js";
import { shouldRenderBranding } from "../../../../packages/cli/src/presentation/index.js";
import type { AuditExecutionResult } from "@a11yst/types";

const BRANDING_PHRASES = ["Your accessibility analyst.", "Always by your side.", "Ally"] as const;

function minimalAuditResult(): AuditExecutionResult {
  return {
    schemaVersion: "1",
    status: "completed",
    summary: {
      status: "completed",
      startedAt: "2026-08-03T10:00:00.000Z",
      durationMs: 1,
      plannedRuns: 1,
      completedRuns: 1,
      skippedRuns: 0,
      failedRuns: 0,
      findingCount: 0,
      findingsBySeverity: { critical: 0, high: 0, medium: 0, minor: 0 },
    },
    plan: {
      projects: [],
      runs: [],
      totalRuns: 1,
      diagnostics: [],
      createdAt: "2026-08-03T10:00:00.000Z",
    },
    runs: [],
    findings: [],
    diagnostics: [],
    limitations: [],
    environment: {
      product: "a11yst",
      productVersion: "1.0.0",
      nodeVersion: "20.0.0",
      browser: "chromium",
      headed: false,
    },
  };
}

const doctorReport: DoctorReport = {
  status: "ok",
  checks: [
    {
      id: "node-version",
      title: "Node.js version",
      status: "ok",
      detail: "Node.js 20.0.0 satisfies minimum 20.0.0.",
    },
  ],
};

describe("machine output branding boundary", () => {
  it("does not render branding for machine or artifact output kinds", () => {
    expect(shouldRenderBranding({ outputKind: "machine" })).toBe(false);
    expect(shouldRenderBranding({ outputKind: "artifact" })).toBe(false);
    expect(shouldRenderBranding({ outputKind: "human" })).toBe(true);
  });

  it("keeps taglines and legacy mascot markers out of audit JSON serialization", () => {
    const json = JSON.stringify(formatAuditJson(minimalAuditResult()));
    for (const phrase of BRANDING_PHRASES) {
      expect(json).not.toContain(phrase);
    }
    expect(json).toContain('"product":"a11yst"');
  });

  it("keeps taglines and legacy mascot markers out of doctor JSON serialization", () => {
    const json = JSON.stringify(formatDoctorJson(doctorReport));
    for (const phrase of BRANDING_PHRASES) {
      expect(json).not.toContain(phrase);
    }
    expect(json).toContain('"product":"a11yst"');
  });

  it("keeps presentation headers out of formatAuditHuman output", () => {
    const output = formatAuditHuman(minimalAuditResult());
    for (const phrase of BRANDING_PHRASES) {
      expect(output).not.toContain(phrase);
    }
    expect(output).toContain("Running accessibility audit.");
  });

  it("keeps presentation headers out of formatDoctorHuman output", () => {
    const output = formatDoctorHuman(doctorReport);
    for (const phrase of BRANDING_PHRASES) {
      expect(output).not.toContain(phrase);
    }
  });
});
