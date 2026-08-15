import type {
  AuditExecutionResult,
  AuditRunResult,
  Finding,
  ResolvedWebProject,
  RouteOrigin,
  SkippedRoutePattern,
} from "@a11yst/types";
import { formatSeverityLabel, severityRank } from "@a11yst/types";
import {
  formatReportSourceLocation,
  resolveFindingReportSource,
} from "./finding-source-report.js";
import {
  buildBaselineReportContext,
  renderBaselineFilters,
  renderBaselineFindingDataAttributes,
  renderBaselineLifecycleSections,
  renderBaselineMetadata,
  renderBaselineNavLinks,
  renderBaselineSummarySection,
} from "./baseline-report.js";
import {
  type LoadedProfileEvidence,
  renderProfileEvidenceSection,
} from "./profile-evidence.js";

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function compareText(left: string | undefined, right: string | undefined): number {
  const a = left ?? "";
  const b = right ?? "";
  return a < b ? -1 : a > b ? 1 : 0;
}

function targetText(finding: Finding): string {
  return finding.target.join(" ");
}

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) ||
      compareText(a.projectName, b.projectName) ||
      compareText(a.route ?? a.routeName ?? a.routeId, b.route ?? b.routeName ?? b.routeId) ||
      compareText(a.viewport, b.viewport) ||
      compareText(a.ruleId, b.ruleId) ||
      compareText(targetText(a), targetText(b)),
  );
}

function safeHelpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}

function evidencePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^(\.\/|\/)+/, "");
  const path = normalized
    .split("/")
    .filter(
      (segment) => segment !== "" && segment !== "." && segment !== "..",
    )
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `../${path || "evidence"}`;
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${milliseconds} ms`;
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
    compareText,
  );
}

function optionList(values: string[]): string {
  return values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
}

function filter(
  label: string,
  name: string,
  values: string[],
  allLabel: string,
): string {
  return `<div class="filter-field">
            <label for="filter-${name}">${escapeHtml(label)}</label>
            <select id="filter-${name}" name="${escapeHtml(name)}">
              <option value="">${escapeHtml(allLabel)}</option>
              ${optionList(values)}
            </select>
          </div>`;
}

function detail(label: string, value: string | undefined): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "Not available")}</dd></div>`;
}

function findingStatus(
  finding: Finding,
  runs: AuditRunResult[],
): AuditRunResult["status"] {
  return (
    runs.find((run) =>
      run.findings.some(
        (candidate) =>
          candidate.id === finding.id &&
          candidate.fingerprint === finding.fingerprint,
      ),
    )?.status ?? "completed"
  );
}

function findingScreenshot(
  finding: Finding,
  runs: AuditRunResult[],
): string | undefined {
  if (finding.evidence?.screenshot) return finding.evidence.screenshot;
  if (finding.evidence?.pageScreenshot) return finding.evidence.pageScreenshot;
  return runs.find((run) =>
    run.findings.some(
      (candidate) =>
        candidate.id === finding.id &&
        candidate.fingerprint === finding.fingerprint,
    ),
  )?.evidence?.screenshot;
}

function renderSourceSection(finding: Finding): string {
  const source = resolveFindingReportSource(finding);
  if (source.status === "mapped" && source.location) {
    const label = source.confidence === "exact" ? "Probable source" : "Probable source";
    const provenance = source.provenance?.replace(/-/g, " ") ?? "source mapping";
    return `<section class="finding-source" aria-labelledby="finding-source-${finding.id}">
        <h4>Source</h4>
        <p>${escapeHtml(label)}: <code>${escapeHtml(formatReportSourceLocation(source.location))}</code></p>
        <p>Confidence: ${escapeHtml(source.confidence ?? "unknown")}</p>
        <p>Matched through ${escapeHtml(provenance)}</p>
      </section>`;
  }
  if (source.status === "ambiguous") {
    const alternatives = source.alternatives ?? [];
    const items = alternatives
      .map((location) => `<li><code>${escapeHtml(formatReportSourceLocation(location))}</code></li>`)
      .join("");
    return `<section class="finding-source" aria-labelledby="finding-source-${finding.id}">
        <h4>Source</h4>
        <p>Source location is ambiguous.</p>
        ${items ? `<ul>${items}</ul>` : ""}
        <p class="muted">Review the listed candidate locations before editing code.</p>
      </section>`;
  }
  if (source.status === "invalid") {
    return `<section class="finding-source"><h4>Source</h4><p class="muted">Source mapping is invalid for this finding.</p></section>`;
  }
  const route = finding.route ?? finding.flowId ?? "Not available";
  return `<section class="finding-source"><h4>Source</h4><p>No source file was selected.</p><p>Context: ${escapeHtml(String(route))}</p></section>`;
}

function renderRecommendationsSection(finding: Finding): string {
  const recommendations = finding.recommendations;
  if (!recommendations || recommendations.recommendations.length === 0) {
    return "";
  }
  const primary = recommendations.recommendations[0]!;
  const actions = primary.actions
    .map((action) => `<li>${escapeHtml(action.title)}: ${escapeHtml(action.description)}</li>`)
    .join("");
  const verification = primary.verification
    .map((step) => `<li>${escapeHtml(step.title)}: ${escapeHtml(step.description)}</li>`)
    .join("");
  const caveats = primary.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join("");
  const examples = primary.examples
    .map(
      (example) =>
        `<h5>${escapeHtml(example.title)}</h5><pre><code>${escapeHtml(example.code)}</code></pre>`,
    )
    .join("");
  return `<section class="finding-recommendations" aria-labelledby="finding-recommendations-${finding.id}">
      <h4>Recommendations</h4>
      <p>Status: ${escapeHtml(recommendations.status)}</p>
      <p>Applicability: ${escapeHtml(primary.applicability)}</p>
      <p>${escapeHtml(primary.summary)}</p>
      ${actions ? `<h5>Actions</h5><ol>${actions}</ol>` : ""}
      ${verification ? `<h5>Verification</h5><ol>${verification}</ol>` : ""}
      ${caveats ? `<h5>Caveats</h5><ul>${caveats}</ul>` : ""}
      ${examples}
      <p class="muted">Automated recommendations do not establish WCAG conformance or guarantee a correct fix.</p>
    </section>`;
}

function renderFinding(
  finding: Finding,
  index: number,
  runs: AuditRunResult[],
): string {
  const route = finding.route ?? finding.routeName ?? finding.routeId ?? "Not available";
  const viewport = finding.viewport ?? "Not available";
  const status = findingStatus(finding, runs);
  const screenshot = findingScreenshot(finding, runs);
  const validHelpUrl = safeHelpUrl(finding.helpUrl);
  const help = finding.helpUrl
    ? validHelpUrl
      ? `<a href="${escapeHtml(validHelpUrl)}">${escapeHtml(finding.helpUrl)}</a>`
      : escapeHtml(finding.helpUrl)
    : "Not available";
  const description = finding.description ?? finding.message ?? "No description provided.";
  const screenshotMarkup = screenshot
    ? `<img class="evidence" src="${escapeHtml(evidencePath(screenshot))}" alt="${escapeHtml(
        `Screenshot evidence for ${finding.title} in ${finding.projectName} at ${route}`,
      )}">`
    : `<p class="muted">No screenshot evidence is available for this finding.</p>`;

  return `<article class="finding finding--${finding.severity}" ${renderBaselineFindingDataAttributes(finding)}
        data-status="${escapeHtml(status)}"
        data-automation="${escapeHtml(finding.automation ?? "automated")}"
        data-confidence="${escapeHtml(finding.confidence ?? "high")}"
        aria-labelledby="finding-${index}-title">
        <h3 id="finding-${index}-title">${escapeHtml(finding.title)}</h3>
        <p class="severity">Severity: ${escapeHtml(formatSeverityLabel(finding.severity))}</p>
        <p>${escapeHtml(description)}</p>
        <dl class="metadata">
          ${detail("Rule ID", finding.ruleId)}
          ${detail("Project", finding.projectName)}
          ${detail("Route", route)}
          ${detail("Flow", finding.flowId)}
          ${detail("Checkpoint", finding.checkpointId)}
          ${detail("URL", finding.url)}
          ${detail("Viewport", viewport)}
          ${detail("Profile", finding.profile)}
          ${detail("Target", finding.target.join(", "))}
          ${detail("Failure summary", finding.failureSummary)}
          ${detail("Standards", finding.standards.join(", "))}
          <div><dt>Help URL</dt><dd>${help}</dd></div>
          ${detail("Fingerprint", finding.fingerprint)}
          ${detail("Automation", finding.automation ?? "automated")}
          ${detail("Confidence", finding.confidence ?? "high")}
        </dl>
        ${renderBaselineMetadata(finding)}
        ${renderSourceSection(finding)}
        ${renderRecommendationsSection(finding)}
        <h4>HTML snippet</h4>
        ${
          finding.html
            ? `<pre><code>${escapeHtml(finding.html)}</code></pre>`
            : `<p class="muted">No HTML snippet is available.</p>`
        }
        ${screenshotMarkup}
      </article>`;
}

function renderDiagnostics(run: AuditRunResult): string {
  if (run.diagnostics.length === 0) {
    return `<p class="muted">No diagnostics.</p>`;
  }
  return `<ul class="diagnostics">${run.diagnostics
    .map(
      (diagnostic) =>
        `<li><strong>${escapeHtml(diagnostic.severity)}: ${escapeHtml(
          diagnostic.code,
        )}</strong> — ${escapeHtml(diagnostic.message)}${
          diagnostic.hint ? ` ${escapeHtml(diagnostic.hint)}` : ""
        }</li>`,
    )
    .join("")}</ul>`;
}

function isWebProject(project: AuditExecutionResult["plan"]["projects"][number]): project is ResolvedWebProject {
  return project.platform === "web";
}

const FIRST_CLASS_ADAPTER_IDS = new Set([
  "html",
  "react",
  "next",
  "angular",
  "vue",
  "nuxt",
]);

function supportLevelLabel(project: ResolvedWebProject): string {
  if (FIRST_CLASS_ADAPTER_IDS.has(project.adapterId)) {
    return "first-class";
  }
  if (project.framework === "unknown") {
    return "unknown";
  }
  return "preview";
}

function collectProjectRoutes(projects: ResolvedWebProject[]): Array<{
  projectName: string;
  path: string;
  origin: RouteOrigin;
  sourceFile?: string;
  pattern?: string;
}> {
  const rows: Array<{
    projectName: string;
    path: string;
    origin: RouteOrigin;
    sourceFile?: string;
    pattern?: string;
  }> = [];

  for (const project of projects) {
    for (const route of project.routes) {
      rows.push({
        projectName: project.name,
        path: route.path,
        origin: route.origin ?? "explicit",
        ...(route.sourceFile !== undefined ? { sourceFile: route.sourceFile } : {}),
        ...(route.pattern !== undefined ? { pattern: route.pattern } : {}),
      });
    }
  }

  return rows.sort(
    (left, right) =>
      compareText(left.projectName, right.projectName) ||
      compareText(left.path, right.path) ||
      compareText(left.origin, right.origin),
  );
}

function collectSkippedPatterns(
  auditResult: AuditExecutionResult,
): SkippedRoutePattern[] {
  const patterns = new Map<string, SkippedRoutePattern>();

  for (const diagnostic of [...auditResult.plan.diagnostics, ...auditResult.diagnostics]) {
    const match = /Dynamic pattern "([^"]+)"/.exec(diagnostic.message);
    if (match?.[1]) {
      patterns.set(match[1], {
        pattern: match[1],
        reason: diagnostic.message,
      });
    }
  }

  return [...patterns.values()].sort((left, right) =>
    compareText(left.pattern, right.pattern),
  );
}

function collectAdapterDiagnostics(auditResult: AuditExecutionResult): AuditExecutionResult["diagnostics"] {
  return [...auditResult.plan.diagnostics, ...auditResult.diagnostics].filter(
    (diagnostic) =>
      diagnostic.code.startsWith("NEXT_") ||
      diagnostic.code.startsWith("NUXT_") ||
      diagnostic.code.startsWith("ANGULAR_") ||
      diagnostic.code.startsWith("HTML_") ||
      diagnostic.code.startsWith("REACT_") ||
      diagnostic.code.startsWith("VUE_") ||
      diagnostic.code.startsWith("GENERIC_") ||
      diagnostic.code.includes("ROUTE") ||
      diagnostic.code.includes("ADAPTER"),
  );
}

function readinessStrategyLabel(run: AuditRunResult): string {
  if (run.adapter?.readinessStrategy) {
    return run.adapter.readinessStrategy;
  }
  const selectors: Partial<Record<string, string>> = {
    next: "#__next, body",
    nuxt: "#__nuxt, body",
    react: "#root, [data-reactroot], body",
    vue: "#app, [data-v-app], body",
    angular: "app-root, body",
    html: "body (load)",
  };
  return selectors[run.framework] ?? "domcontentloaded + body";
}

function renderFrameworkIntegration(projects: ResolvedWebProject[]): string {
  if (projects.length === 0) {
    return `<p class="muted">No web project metadata is available for this audit.</p>`;
  }

  const rows = projects
    .map(
      (project) => `<tr>
          <td>${escapeHtml(project.name)}</td>
          <td>${escapeHtml(project.framework)}</td>
          <td>${escapeHtml(project.adapterId)}</td>
          <td>${escapeHtml(supportLevelLabel(project))}</td>
        </tr>`,
    )
    .join("");

  return `<div class="table-wrap" tabindex="0">
      <table>
        <caption class="visually-hidden">Framework integration per configured web project</caption>
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Framework</th>
            <th scope="col">Adapter</th>
            <th scope="col">Support level</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderRouteTable(
  routes: ReturnType<typeof collectProjectRoutes>,
): string {
  if (routes.length === 0) {
    return `<p class="muted">No resolved routes were recorded for this audit.</p>`;
  }

  const rows = routes
    .map(
      (route) => `<tr>
          <td>${escapeHtml(route.projectName)}</td>
          <td>${escapeHtml(route.path)}</td>
          <td>${escapeHtml(route.origin)}</td>
          <td>${escapeHtml(route.sourceFile ?? "Not available")}</td>
          <td>${escapeHtml(route.pattern ?? "Not available")}</td>
        </tr>`,
    )
    .join("");

  return `<div class="table-wrap" tabindex="0">
      <table>
        <caption class="visually-hidden">Resolved routes included in the audit plan</caption>
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Path</th>
            <th scope="col">Origin</th>
            <th scope="col">Source file</th>
            <th scope="col">Pattern</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderSkippedPatterns(patterns: SkippedRoutePattern[]): string {
  if (patterns.length === 0) {
    return `<p class="muted">No dynamic route patterns were skipped.</p>`;
  }

  return `<ul class="diagnostics">${patterns
    .map(
      (pattern) =>
        `<li><strong>${escapeHtml(pattern.pattern)}</strong> — ${escapeHtml(pattern.reason)}${
          pattern.sourceFile ? ` (${escapeHtml(pattern.sourceFile)})` : ""
        }</li>`,
    )
    .join("")}</ul>`;
}

function renderRun(
  run: AuditRunResult,
  index: number,
  loadedEvidence?: Map<string, LoadedProfileEvidence>,
): string {
  const route =
    run.kind === "flow-checkpoint"
      ? `${run.flowName ?? run.flowId ?? "Flow"} — ${run.checkpointName ?? run.checkpointId ?? "checkpoint"}`
      : run.route ?? run.routeName ?? run.routeId ?? "Not available";
  const screenshot = run.evidence?.screenshot;
  const hasStructuredEvidence = loadedEvidence?.has(run.runId) ?? false;
  const evidenceAnchor = hasStructuredEvidence
    ? `<p><a href="#profile-evidence">View structured profile evidence</a> for this run.</p>`
    : "";
  const flowDetails =
    run.kind === "flow-checkpoint"
      ? `${detail("Flow", run.flowName ?? run.flowId)}
          ${detail("Checkpoint", run.checkpointName ?? run.checkpointId)}
          ${detail("Flow start", run.route)}
          ${detail("Flow trace", run.flowTracePath)}`
      : "";
  return `<article class="run" aria-labelledby="run-${index}-title">
        <h3 id="run-${index}-title">${escapeHtml(run.projectName)} — ${escapeHtml(route)}</h3>
        <p class="status">Status: ${escapeHtml(run.status)}</p>
        <dl class="metadata">
          ${detail("Run ID", run.runId)}
          ${detail("Kind", run.kind ?? "route")}
          ${detail("Profile", run.profile)}
          ${detail("Viewport", run.viewport?.name)}
          ${detail("URL", run.url ?? run.evidence?.finalUrl)}
          ${detail("Duration", formatDuration(run.durationMs))}
          ${detail("Findings", String(run.findings.length))}
          ${flowDetails}
          ${detail("Readiness strategy", readinessStrategyLabel(run))}
          ${detail("Skip reason", run.skipReason)}
        </dl>
        ${
          run.findings.length === 0
            ? `<p class="muted">No findings were recorded for this run.</p>`
            : ""
        }
        ${
          screenshot
            ? `<img class="evidence" src="${escapeHtml(
                evidencePath(screenshot),
              )}" alt="${escapeHtml(`Page screenshot for ${run.projectName} at ${route}`)}">`
            : `<p class="muted">No run screenshot is available.</p>`
        }
        ${evidenceAnchor}
        <h4>Diagnostics</h4>
        ${renderDiagnostics(run)}
      </article>`;
}

export interface RenderHtmlReportOptions {
  auditId?: string;
  loadedProfileEvidence?: Map<string, LoadedProfileEvidence>;
}

function renderProfileCoverage(auditResult: AuditExecutionResult): string {
  const summary = auditResult.profileSummary;
  if (!summary) {
    return `<p class="muted">Profile coverage summary is not available for this audit.</p>`;
  }

  const cards = summary.coverage
    .filter(
      (entry, index, all) =>
        all.findIndex((candidate) => candidate.profile === entry.profile) === index,
    )
    .map((entry) => {
      const lists = [
        entry.automatedChecks.length > 0
          ? `<div><h4>Automated</h4><ul>${entry.automatedChecks
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul></div>`
          : "",
        entry.heuristicChecks.length > 0
          ? `<div><h4>Heuristic</h4><ul>${entry.heuristicChecks
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul></div>`
          : "",
        entry.manualChecks.length > 0
          ? `<div><h4>Manual review still required</h4><ul>${entry.manualChecks
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul></div>`
          : "",
        entry.limitations.length > 0
          ? `<div><h4>Limitations</h4><ul>${entry.limitations
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul></div>`
          : "",
      ].join("");

      return `<article class="coverage-card coverage-card--profile">
          <h3>${escapeHtml(entry.profile.toUpperCase())}</h3>
          <p class="status">Status: ${escapeHtml(entry.status)}</p>
          ${lists || `<p class="muted">No coverage metadata recorded.</p>`}
        </article>`;
    })
    .join("");

  const totalFindings =
    summary.findingsByAutomation.automated +
    summary.findingsByAutomation.heuristic +
    summary.findingsByAutomation["manual-review"];

  return `<div class="coverage-grid coverage-grid--profiles">${cards}</div>
      <dl class="metadata metadata--inline coverage-stats">
        <div><dt>Findings</dt><dd>${totalFindings}</dd></div>
        <div><dt>Automated</dt><dd>${summary.findingsByAutomation.automated}</dd></div>
        <div><dt>Heuristic</dt><dd>${summary.findingsByAutomation.heuristic}</dd></div>
        <div><dt>Generated manual checks</dt><dd>${summary.findingsByAutomation["manual-review"]}</dd></div>
        <div><dt>Manual review pending</dt><dd>${summary.manualReviewPending}</dd></div>
      </dl>`;
}

export function renderHtmlReport(
  auditResult: AuditExecutionResult,
  options: RenderHtmlReportOptions = {},
): string {
  const findings = sortFindings(auditResult.findings);
  const baselineContext = buildBaselineReportContext(auditResult);
  const reportId = options.auditId ?? auditResult.auditId;
  const loadedEvidence = options.loadedProfileEvidence;
  const title = reportId
    ? `a11yst accessibility report — ${reportId}`
    : "a11yst accessibility report";
  const webProjects = auditResult.plan.projects.filter(isWebProject);
  const routeRows = collectProjectRoutes(webProjects);
  const skippedPatterns = collectSkippedPatterns(auditResult);
  const adapterDiagnostics = collectAdapterDiagnostics(auditResult);
  const routes = findings.map(
    (finding) => finding.route ?? finding.routeName ?? finding.routeId ?? "Not available",
  );
  const flows = unique(findings.map((finding) => finding.flowId));
  const checkpoints = unique(findings.map((finding) => finding.checkpointId));
  const viewports = findings.map((finding) => finding.viewport ?? "Not available");
  const statuses = findings.map((finding) => findingStatus(finding, auditResult.runs));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="styles.css">
  <script src="report.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header class="site-header">
    <div class="site-header__inner">
      <h1>${escapeHtml(title)}</h1>
      <p>Static accessibility audit results</p>
      <nav aria-label="Report sections">
        <ul>
          <li><a href="#summary">Summary</a></li>
          ${renderBaselineNavLinks(baselineContext)}
          <li><a href="#framework-integration">Framework integration</a></li>
          <li><a href="#findings">Findings</a></li>
          <li><a href="#runs">Runs</a></li>
          <li><a href="#profile-evidence">Profile evidence</a></li>
          <li><a href="#coverage">Coverage</a></li>
        </ul>
      </nav>
    </div>
  </header>
  <main id="main-content">
    <section id="summary" aria-labelledby="summary-title">
      <h2 id="summary-title">Summary</h2>
      <div class="summary-grid">
        <div class="summary-card"><span>Total findings</span><strong>${auditResult.summary.findingCount}</strong></div>
        <div class="summary-card summary-card--critical"><span>Critical severity</span><strong>${auditResult.summary.findingsBySeverity.critical}</strong></div>
        <div class="summary-card summary-card--high"><span>High severity</span><strong>${auditResult.summary.findingsBySeverity.high}</strong></div>
        <div class="summary-card summary-card--medium"><span>Medium severity</span><strong>${auditResult.summary.findingsBySeverity.medium}</strong></div>
        <div class="summary-card summary-card--minor"><span>Minor severity</span><strong>${auditResult.summary.findingsBySeverity.minor}</strong></div>
        <div class="summary-card"><span>Completed runs</span><strong>${auditResult.summary.completedRuns}</strong></div>
        <div class="summary-card"><span>Skipped runs</span><strong>${auditResult.summary.skippedRuns}</strong></div>
        <div class="summary-card"><span>Failed runs</span><strong>${auditResult.summary.failedRuns}</strong></div>
        ${
          auditResult.flowSummary
            ? `<div class="summary-card"><span>Configured flows</span><strong>${auditResult.flowSummary.configuredFlows}</strong></div>
        <div class="summary-card"><span>Completed checkpoints</span><strong>${auditResult.flowSummary.completedCheckpoints}</strong></div>
        <div class="summary-card"><span>Skipped checkpoints</span><strong>${auditResult.flowSummary.skippedCheckpoints}</strong></div>`
            : ""
        }
      </div>
      <p>Audit duration: ${escapeHtml(formatDuration(auditResult.summary.durationMs))}</p>
    </section>

    ${renderBaselineSummarySection(baselineContext)}

    ${renderBaselineLifecycleSections(baselineContext, findings, (finding, index) =>
      renderFinding(finding, index, auditResult.runs),
    )}

    <section id="framework-integration" aria-labelledby="framework-integration-title">
      <h2 id="framework-integration-title">Framework integration</h2>
      ${renderFrameworkIntegration(webProjects)}

      <h3 id="route-table-title">Resolved routes</h3>
      ${renderRouteTable(routeRows)}

      <h3 id="skipped-patterns-title">Skipped dynamic patterns</h3>
      ${renderSkippedPatterns(skippedPatterns)}

      <h3 id="adapter-diagnostics-title">Adapter diagnostics</h3>
      ${
        adapterDiagnostics.length === 0
          ? `<p class="muted">No adapter diagnostics were recorded.</p>`
          : `<ul class="diagnostics">${adapterDiagnostics
              .map(
                (diagnostic) =>
                  `<li><strong>${escapeHtml(diagnostic.severity)}: ${escapeHtml(
                    diagnostic.code,
                  )}</strong> — ${escapeHtml(diagnostic.message)}${
                    diagnostic.hint ? ` ${escapeHtml(diagnostic.hint)}` : ""
                  }</li>`,
              )
              .join("")}</ul>`
      }
    </section>

    <section id="findings" aria-labelledby="findings-title">
      <h2 id="findings-title">Findings</h2>
      <form class="filters" data-report-filters>
        <div class="filter-grid">
          ${renderBaselineFilters(findings, baselineContext)}
          ${filter("Severity", "severity", ["critical", "high", "medium", "minor"], "All severities")}
          ${filter("Project", "project", unique(findings.map((finding) => finding.projectName)), "All projects")}
          ${filter("Route", "route", unique(routes), "All routes")}
          ${flows.length > 0 ? filter("Flow", "flow", flows, "All flows") : ""}
          ${checkpoints.length > 0 ? filter("Checkpoint", "checkpoint", checkpoints, "All checkpoints") : ""}
          ${filter("Viewport", "viewport", unique(viewports), "All viewports")}
          ${filter("Profile", "profile", unique(findings.map((finding) => finding.profile)), "All profiles")}
          ${filter("Source", "source", unique(findings.map((finding) => finding.source)), "All sources")}
          ${filter("Automation", "automation", unique(findings.map((finding) => finding.automation ?? "automated")), "All automation types")}
          ${filter("Confidence", "confidence", unique(findings.map((finding) => finding.confidence ?? "high")), "All confidence levels")}
          ${filter("Rule", "rule", unique(findings.map((finding) => finding.ruleId)), "All rules")}
          ${filter("Run status", "status", unique(statuses), "All statuses")}
        </div>
        <button type="reset">Clear filters</button>
      </form>
      <p class="result-count" data-result-count aria-live="polite">${findings.length} ${
        findings.length === 1 ? "finding" : "findings"
      } shown</p>
      ${
        findings.length === 0
          ? `<div class="empty-state"><h3>No findings</h3><p>No accessibility findings were recorded in this audit.</p></div>`
          : `<div class="findings-list">${findings
              .map((finding, index) => renderFinding(finding, index, auditResult.runs))
              .join("")}</div>`
      }
    </section>

    <section id="runs" aria-labelledby="runs-title">
      <h2 id="runs-title">Runs</h2>
      ${
        auditResult.runs.length === 0
          ? `<div class="empty-state"><h3>No runs</h3><p>No audit runs were recorded.</p></div>`
          : `<div class="run-grid">${auditResult.runs
              .map((run, index) => renderRun(run, index, loadedEvidence))
              .join("")}</div>`
      }
    </section>

    <section id="profile-evidence" aria-labelledby="profile-evidence-title">
      <h2 id="profile-evidence-title">Profile evidence</h2>
      <p class="muted">Structured keyboard focus sequences and large-text before/after comparisons captured during profile runs.</p>
      ${renderProfileEvidenceSection(auditResult.runs, loadedEvidence ?? new Map())}
    </section>

    <section id="coverage" aria-labelledby="coverage-title">
      <h2 id="coverage-title">Coverage and limitations</h2>
      <h3 id="profile-coverage-title">Profile coverage</h3>
      ${renderProfileCoverage(auditResult)}
      <div class="disclaimers">
        <p>Accessibility profiles approximate test conditions. They do not reproduce the complete experience of disabled users or assistive technologies.</p>
        <p>a11yst does not certify WCAG conformance.</p>
        <p>Automated checks cover only part of accessibility.</p>
        <p>Manual review and testing with disabled users remain necessary.</p>
      </div>
    </section>
  </main>
  <footer>
    <p>Generated by a11yst${reportId ? ` for audit ${escapeHtml(reportId)}` : ""}.</p>
  </footer>
</body>
</html>
`;
}
