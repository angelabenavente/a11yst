import type { AuditExecutionResult } from "@a11yst/types";

export type DemoSummary = {
  findings: {
    total: number;
    new: number;
    known: number;
    regressed: number;
    resolved: number;
    notCompared: number;
    interactive: number;
  };
  sourceAnalysis: {
    mapped: number;
    ambiguous: number;
    unmapped: number;
    invalid: number;
  };
  recommendations: {
    findingsWithRecommendations: number;
  };
  policy: {
    exitCode: number;
    breached: boolean;
    enabled: boolean;
  };
};

export type DemoReportLocations = {
  json?: string;
  html?: string;
  sarif?: string;
  junit?: string;
  markdown?: string;
  githubAnnotations?: string;
  demoSummary: string;
};

export function createDemoSummary(
  results: AuditExecutionResult,
  policyExitCode?: number,
): DemoSummary;

export function resolveReportLocations(
  demoRoot: string,
  runDir: string,
  results: AuditExecutionResult,
): DemoReportLocations;

export function resolveDemoOutputRoot(demoRoot: string): string;

export function renderDemoSummary(
  summary: DemoSummary,
  reportLocations: DemoReportLocations,
): string;

export function renderDemoSummaryMarkdown(
  summary: DemoSummary,
  reportLocations: DemoReportLocations,
): string;

export function renderDemoHeader(): string;

export function renderStageProgress(stageLabel: string): string;
