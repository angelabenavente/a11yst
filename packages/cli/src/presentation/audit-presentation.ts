import type {
  AuditExecutionResult,
  AuditRunResult,
  Finding,
  Severity,
} from "@a11yst/types";
import {
  buildFindingGroupKey,
  countUniqueIssues,
  formatReportSourceLocation,
  groupFindings,
  resolveFindingReportSource,
  type FindingGroup,
} from "@a11yst/reporters";

export {
  buildFindingGroupKey,
  countUniqueIssues,
  groupFindings,
  type FindingGroup,
};
import { padVisible, styleSeverityLabel, styleText } from "./ansi.js";
import type { ColorMode } from "./color.js";
import { resolveColorEnabled } from "./color.js";
import type { TerminalCapabilities, TerminalPresentationMode } from "./types.js";
import { resolveTerminalPresentationMode } from "./mode.js";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "minor"];
const MAX_AFFECTED_INSTANCES = 10;
const WIDE_TABLE_MIN_WIDTH = 96;
const NARROW_TABLE_MIN_WIDTH = 56;

export type AuditPresentationOptions = {
  colorMode?: ColorMode;
  capabilities?: TerminalCapabilities;
  presentationMode?: TerminalPresentationMode;
  terminalWidth?: number;
  verbose?: boolean;
};

function formatTargetSelector(target: string[]): string {
  if (target.length === 0) {
    return "(no target)";
  }
  return target.join(" > ");
}

function formatSourceLabel(finding: Finding, verbose: boolean): {
  label: string;
  kind: "source" | "target";
  confidence?: string;
} {
  const ranked = finding.sourceRanking?.selected;
  if (ranked?.location) {
    const location = formatReportSourceLocation(ranked.location);
    return {
      label: location,
      kind: "source",
      confidence: ranked.effectiveConfidence,
    };
  }

  const source = resolveFindingReportSource(finding);
  if (source.status === "mapped" && source.location) {
    return {
      label: formatReportSourceLocation(source.location),
      kind: "source",
      confidence: source.confidence,
    };
  }
  if (source.status === "ambiguous" && source.alternatives?.[0]) {
    return {
      label: formatReportSourceLocation(source.alternatives[0]),
      kind: "source",
      confidence: "ambiguous",
    };
  }

  if (verbose) {
    return {
      label: formatTargetSelector(finding.target),
      kind: "target",
    };
  }
  return {
    label: formatTargetSelector(finding.target),
    kind: "target",
  };
}

function formatConfidenceHint(confidence: string | undefined, colorEnabled: boolean): string {
  if (!confidence || confidence === "exact" || confidence === "high") {
    return "";
  }
  const text = `(${confidence} confidence)`;
  return colorEnabled ? styleText(text, { dim: true }, true) : text;
}

function formatGroupSourceSummary(group: FindingGroup): string {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const finding of group.findings) {
    const { label } = formatSourceLabel(finding, false);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  if (labels.length === 0) {
    return "(unknown)";
  }
  if (labels.length === 1) {
    return labels[0]!;
  }
  return `${labels[0]!} +${labels.length - 1}`;
}

function resolveTerminalWidth(explicit?: number): number {
  if (explicit !== undefined && explicit > 0) {
    return explicit;
  }
  return process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 80;
}

function resolvePresentationContext(options: AuditPresentationOptions = {}): {
  colorEnabled: boolean;
  mode: TerminalPresentationMode;
  width: number;
  verbose: boolean;
} {
  const capabilities = options.capabilities ?? {
    isTTY: Boolean(process.stdout.isTTY),
    isStderrTTY: Boolean(process.stderr.isTTY),
    isCI: false,
    isDumbTerminal: false,
    noColor: false,
    supportsColor: Boolean(process.stdout.isTTY),
  };
  const mode =
    options.presentationMode ?? resolveTerminalPresentationMode(capabilities);
  const colorMode = options.colorMode ?? "auto";
  return {
    colorEnabled: resolveColorEnabled(colorMode, capabilities),
    mode,
    width: resolveTerminalWidth(options.terminalWidth),
    verbose: options.verbose ?? false,
  };
}

function formatExecutionStatusLine(result: AuditExecutionResult): string[] {
  if (result.status === "failed") {
    return ["Execution   FAILED"];
  }
  if (result.summary.failedRuns > 0) {
    return [
      "Execution   SUCCESS",
      `Accessibility  ${result.summary.findingCount} barrier${result.summary.findingCount === 1 ? "" : "s"} found; ${result.summary.failedRuns} run${result.summary.failedRuns === 1 ? "" : "s"} failed`,
    ];
  }
  if (result.summary.findingCount > 0) {
    return [
      "Execution   SUCCESS",
      `Accessibility  ${result.summary.findingCount} barrier${result.summary.findingCount === 1 ? "" : "s"} found`,
    ];
  }
  return ["Execution   SUCCESS", "Accessibility  no barriers found"];
}

function formatRunStatusLine(run: AuditRunResult): string {
  if (run.status === "skipped") {
    return "SKIP";
  }
  if (run.status === "failed") {
    return "ERROR";
  }
  if (run.findings.length === 0) {
    return "PASS  No automated barriers found";
  }

  const automated = run.findings.filter(
    (finding) => (finding.automation ?? "automated") === "automated",
  ).length;
  const heuristic = run.findings.filter((finding) => finding.automation === "heuristic").length;
  const review = run.findings.filter((finding) => finding.automation === "manual-review").length;

  const parts: string[] = [];
  if (automated > 0) {
    parts.push(`${automated} automated barrier${automated === 1 ? "" : "s"}`);
  }
  if (heuristic > 0) {
    parts.push(`${heuristic} heuristic finding${heuristic === 1 ? "" : "s"}`);
  }
  if (review > 0) {
    parts.push(`${review} generated manual check${review === 1 ? "" : "s"}`);
  }
  return `ISSUES  ${parts.join("; ")}`;
}

function formatSummaryTable(
  groups: FindingGroup[],
  ctx: ReturnType<typeof resolvePresentationContext>,
): string[] {
  if (groups.length === 0) {
    return [];
  }

  const lines: string[] = ["Summary", ""];
  const wide = ctx.mode === "interactive" && ctx.width >= WIDE_TABLE_MIN_WIDTH;
  const narrow = ctx.mode === "interactive" && ctx.width >= NARROW_TABLE_MIN_WIDTH;

  if (wide) {
    const severityWidth = 10;
    const ruleWidth = Math.min(24, Math.max(12, ...groups.map((group) => group.ruleId.length)));
    const affectedWidth = 10;
    lines.push(
      [
        padVisible("Severity", severityWidth),
        padVisible("Rule", ruleWidth),
        padVisible("Affected", affectedWidth),
        "Route/Source",
      ].join("  "),
    );
    for (const group of groups) {
      const route =
        group.findings.length === 1
          ? (group.findings[0]?.route ?? formatGroupSourceSummary(group))
          : formatGroupSourceSummary(group);
      lines.push(
        [
          padVisible(styleSeverityLabel(group.severity, ctx.colorEnabled), severityWidth),
          padVisible(group.ruleId, ruleWidth),
          padVisible(String(group.findings.length), affectedWidth),
          route,
        ].join("  "),
      );
    }
    lines.push("");
    return lines;
  }

  if (narrow) {
    for (const group of groups) {
      lines.push(
        `${styleSeverityLabel(group.severity, ctx.colorEnabled)}  ${group.ruleId}  x${group.findings.length}  ${formatGroupSourceSummary(group)}`,
      );
    }
    lines.push("");
    return lines;
  }

  for (const group of groups) {
    lines.push(
      `${group.severity.toUpperCase()}  ${group.ruleId}  ${group.findings.length}  ${formatGroupSourceSummary(group)}`,
    );
  }
  lines.push("");
  return lines;
}

function resolveEngineLabel(source: Finding["source"]): string | undefined {
  if (source === "axe") {
    return "axe-core";
  }
  if (source === "a11yst") {
    return "a11yst";
  }
  return undefined;
}

function formatVerboseFindingDetails(finding: Finding, colorEnabled: boolean): string[] {
  const lines: string[] = [];
  if (finding.target.length > 0) {
    lines.push("Target selector:");
    for (const target of finding.target) {
      lines.push(`  ${target}`);
    }
  }
  const engine = resolveEngineLabel(finding.source);
  if (engine || finding.sourceImpact) {
    lines.push("");
    lines.push("Technical provenance");
    if (engine) {
      lines.push(`Engine         ${engine}`);
    }
    if (finding.sourceImpact) {
      lines.push(`Source impact  ${finding.sourceImpact}`);
    }
  }
  if (finding.failureSummary) {
    lines.push("Failure summary:");
    lines.push(`  ${finding.failureSummary}`);
  }
  if (finding.description) {
    lines.push(`Description: ${finding.description}`);
  }
  if (finding.sourceRanking?.ranked?.length) {
    lines.push("Source ranking:");
    for (const ranked of finding.sourceRanking.ranked.slice(0, 5)) {
      const location = formatReportSourceLocation(ranked.location);
      lines.push(
        `  ${location}  score=${ranked.score}  confidence=${ranked.effectiveConfidence}`,
      );
    }
    for (const diagnostic of finding.sourceRanking.diagnostics.slice(0, 3)) {
      lines.push(`  [${diagnostic.level}] ${diagnostic.message}`);
    }
  }
  if (finding.evidence) {
    lines.push("Evidence:");
    lines.push(
      `  ${styleText(JSON.stringify(finding.evidence), { dim: true }, colorEnabled)}`,
    );
  }
  return lines;
}

function formatGroupDetail(
  group: FindingGroup,
  ctx: ReturnType<typeof resolvePresentationContext>,
): string[] {
  const lines: string[] = [
    `${styleSeverityLabel(group.severity, ctx.colorEnabled)}  ${group.ruleId}`,
    group.title,
    `Affected elements: ${group.findings.length}`,
  ];

  lines.push("");
  lines.push("Affected elements");
  const visible = group.findings.slice(0, MAX_AFFECTED_INSTANCES);
  visible.forEach((finding, index) => {
    const source = formatSourceLabel(finding, ctx.verbose);
    const prefix = source.kind === "source" ? "Likely source" : "Target";
    const confidence = formatConfidenceHint(source.confidence, ctx.colorEnabled);
    const routeSuffix = finding.route ? `  (${finding.route})` : "";
    lines.push(
      `  ${index + 1}. ${prefix}  ${source.label}${confidence ? `  ${confidence}` : ""}${routeSuffix}`,
    );
  });
  const remaining = group.findings.length - visible.length;
  if (remaining > 0) {
    lines.push(`  + ${remaining} more (see JSON/HTML report or use --verbose)`);
  }

  if (group.recommendation?.summary || group.recommendation?.title) {
    lines.push("");
    lines.push("Recommendation");
    if (group.recommendation.title) {
      lines.push(`  ${group.recommendation.title}`);
    }
    if (group.recommendation.summary) {
      lines.push(`  ${group.recommendation.summary}`);
    }
  }

  if (ctx.verbose) {
    lines.push("");
    lines.push("Verbose details");
    for (const finding of group.findings.slice(0, MAX_AFFECTED_INSTANCES)) {
      lines.push(...formatVerboseFindingDetails(finding, ctx.colorEnabled));
      lines.push("");
    }
  }

  lines.push("");
  return lines;
}

export function formatAuditFindingsPresentation(
  findings: Finding[],
  options: AuditPresentationOptions = {},
): string[] {
  const ctx = resolvePresentationContext(options);
  const groups = groupFindings(findings);
  const lines: string[] = [];

  lines.push(...formatSummaryTable(groups, ctx));

  if (groups.length > 0) {
    lines.push("Issues", "");
    for (const group of groups) {
      lines.push(...formatGroupDetail(group, ctx));
    }
  }

  return lines;
}

export function formatAuditRunSummaries(
  runs: AuditRunResult[],
  options: { skipFlowCheckpoints?: boolean } = {},
): string[] {
  const lines: string[] = [];
  for (const run of runs) {
    if (options.skipFlowCheckpoints && run.kind === "flow-checkpoint") {
      continue;
    }
    if (run.status === "completed") {
      const route = run.route ?? "(no route)";
      const profile = run.profile;
      const viewport = run.viewport?.name ?? "(no viewport)";
      lines.push(`RUN   ${route.padEnd(20)} ${profile.padEnd(16)} ${viewport}`);
      lines.push(formatRunStatusLine(run));
      lines.push("");
      continue;
    }

    const route = run.route ?? "(n/a)";
    const profile = run.profile;
    const viewport = run.viewport?.name ?? "";
    const label = run.status === "skipped" ? "SKIP" : "ERROR";
    const location = [route, profile, viewport].filter(Boolean).join("  ");
    const reason = run.skipReason ?? run.diagnostics[0]?.message ?? "see diagnostics";
    lines.push(`${label}  ${location}`);
    lines.push(`      ${reason}`);
    lines.push("");
  }
  return lines;
}

export function formatAuditExecutionHeader(
  result: AuditExecutionResult,
  labelValue: (label: string, value: string | number) => string,
): string[] {
  const lines: string[] = [];
  const webProject = result.plan.projects.find((project) => project.platform === "web");
  if (webProject && webProject.platform === "web") {
    lines.push(labelValue("Project", webProject.name));
    lines.push(labelValue("Framework", webProject.framework));
    lines.push(labelValue("Target", webProject.baseUrl));
    lines.push(labelValue("Browser", result.environment.browser ?? "chromium"));
    lines.push(labelValue("Mode", result.environment.headed ? "headed" : "headless"));
    const uniqueRoutes = new Set(
      result.runs.map((run) => run.route).filter((route): route is string => Boolean(route)),
    );
    if (uniqueRoutes.size > 0) {
      lines.push(labelValue("Routes", String(uniqueRoutes.size)));
    }
    if (result.summary.plannedRuns > 0) {
      lines.push(labelValue("Planned runs", String(result.summary.plannedRuns)));
    }
    lines.push("");
  }
  lines.push(...formatExecutionStatusLine(result));
  lines.push("");
  return lines;
}

export function formatAuditFooterSummary(result: AuditExecutionResult): string[] {
  const groups = groupFindings(result.findings);
  const uniqueRoutes = new Set(
    result.runs.map((run) => run.route).filter((route): route is string => Boolean(route)),
  );
  const profiles = new Set(result.runs.map((run) => run.profile));
  const viewports = new Set(
    result.runs
      .map((run) => run.viewport?.name)
      .filter((viewport): viewport is string => Boolean(viewport)),
  );

  const lines: string[] = ["Summary", ""];
  lines.push(`Routes              ${uniqueRoutes.size}`);
  lines.push(`Profiles            ${profiles.size}`);
  lines.push(`Viewports           ${viewports.size}`);
  lines.push(`Unique issues       ${groups.length}`);
  lines.push(`Affected elements   ${result.summary.findingCount}`);
  lines.push("");

  for (const severity of SEVERITY_ORDER) {
    const count = result.summary.findingsBySeverity[severity];
    if (count > 0) {
      const label = `${severity.charAt(0).toUpperCase()}${severity.slice(1)}`;
      lines.push(`${label.padEnd(20)}${count}`);
    }
  }

  lines.push("");
  lines.push(`Planned             ${result.summary.plannedRuns}`);
  lines.push(`Completed           ${result.summary.completedRuns}`);
  lines.push(`Skipped             ${result.summary.skippedRuns}`);
  lines.push(`Failed runs         ${result.summary.failedRuns}`);
  lines.push("");
  return lines;
}

export function formatProfileReviewSections(result: AuditExecutionResult): string[] {
  if (!result.profileSummary) {
    return [];
  }

  const lines: string[] = ["Profiles completed"];
  for (const profile of result.profileSummary.completed) {
    lines.push(`- ${profile}`);
  }
  lines.push("");
  lines.push("Findings");
  lines.push(`Automated findings       ${result.profileSummary.findingsByAutomation.automated}`);
  lines.push(`Heuristic findings       ${result.profileSummary.findingsByAutomation.heuristic}`);
  lines.push(
    `Generated manual checks  ${result.profileSummary.manualReviewPending}`,
  );
  lines.push("");
  lines.push("Coverage");
  for (const coverage of result.profileSummary.coverage) {
    lines.push("");
    lines.push(coverage.profile.toUpperCase());
    lines.push("Automated checks completed");
    for (const check of coverage.automatedChecks) {
      lines.push(`- ${check}`);
    }
    if (coverage.manualChecks.length > 0) {
      lines.push("Manual accessibility review still required");
      for (const check of coverage.manualChecks) {
        lines.push(`- ${check}`);
      }
    }
    if (coverage.limitations.length > 0) {
      lines.push("Not covered");
      for (const limitation of coverage.limitations) {
        lines.push(`- ${limitation}`);
      }
    }
  }
  lines.push("");
  return lines;
}