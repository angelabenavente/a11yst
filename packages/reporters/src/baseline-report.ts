import type {
  AuditExecutionResult,
  BaselineSummary,
  ComparisonCoverage,
  Finding,
  FindingDisposition,
  FindingLifecycleStatus,
  NotComparedFinding,
  RegressionReason,
  ResolvedFinding,
} from "@a11yst/types";
import {
  CURRENT_BASELINE_SCHEMA_VERSION,
  CURRENT_FINGERPRINT_VERSION,
} from "@a11yst/types";

export function escapeHtml(value: unknown): string {
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
  if (values.length === 0) return "";
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

const dispositionLabels: Record<FindingDisposition, string> = {
  "false-positive": "False positive",
  "accepted-risk": "Accepted risk",
  "third-party": "Third party",
  "not-applicable": "Not applicable",
  "manual-review": "Manual review",
};

const regressionLabels: Record<RegressionReason, string> = {
  "severity-increased": "Severity increased",
  "classification-expired": "Classification expired",
  "returned-after-resolution": "Returned after resolution",
  "confidence-increased": "Confidence increased",
  "scope-expanded": "Scope expanded",
};

const lifecycleLabels: Record<FindingLifecycleStatus | "resolved" | "not-compared", string> = {
  new: "New",
  known: "Known",
  regressed: "Regressed",
  resolved: "Resolved",
  "not-compared": "Not compared",
};

export function buildComparisonCoverage(result: AuditExecutionResult): ComparisonCoverage {
  const comparedProjects = new Set<string>();
  const comparedProfiles = new Set<string>();
  const comparedViewports = new Set<string>();
  const comparedRoutes = new Set<string>();
  const comparedFlows = new Map<string, Set<string>>();
  const failedRuns: string[] = [];
  const skippedRuns: string[] = [];
  const plannedProjects = new Set(result.plan.projects.map((project) => project.name));

  for (const run of result.runs) {
    if (run.status === "failed") {
      failedRuns.push(run.runId);
      continue;
    }
    if (run.status === "skipped") {
      skippedRuns.push(run.runId);
      continue;
    }
    if (run.status !== "completed") {
      continue;
    }

    comparedProjects.add(run.projectName);
    comparedProfiles.add(run.profile);
    if (run.viewport?.name) {
      comparedViewports.add(run.viewport.name);
    }

    if (run.kind === "flow-checkpoint" || run.flowId) {
      if (run.flowId && run.checkpointId) {
        const checkpoints = comparedFlows.get(run.flowId) ?? new Set<string>();
        checkpoints.add(run.checkpointId);
        comparedFlows.set(run.flowId, checkpoints);
      }
    } else if (run.route) {
      comparedRoutes.add(run.route);
    }
  }

  const excludedProjects = [...plannedProjects]
    .filter((project) => !comparedProjects.has(project))
    .sort();

  return {
    comparedProjects: [...comparedProjects].sort(),
    comparedProfiles: [...comparedProfiles].sort(),
    comparedViewports: [...comparedViewports].sort(),
    comparedRoutes: [...comparedRoutes].sort(),
    comparedFlows: [...comparedFlows.entries()]
      .map(([flowId, checkpointIds]) => ({
        flowId,
        checkpointIds: [...checkpointIds].sort(),
      }))
      .sort((left, right) => left.flowId.localeCompare(right.flowId)),
    excludedProjects,
    failedRuns: failedRuns.sort(),
    skippedRuns: skippedRuns.sort(),
  };
}

export interface BaselineReportContext {
  baselineUsed: boolean;
  baselineSummary?: BaselineSummary;
  resolvedFindings: ResolvedFinding[];
  notComparedFindings: NotComparedFinding[];
  coverage?: ComparisonCoverage;
  schemaVersion: typeof CURRENT_BASELINE_SCHEMA_VERSION;
  fingerprintVersion: typeof CURRENT_FINGERPRINT_VERSION;
}

export function buildBaselineReportContext(
  auditResult: AuditExecutionResult,
): BaselineReportContext {
  const baselineUsed = auditResult.baselineSummary?.baselineUsed ?? false;
  return {
    baselineUsed,
    baselineSummary: auditResult.baselineSummary,
    resolvedFindings: auditResult.resolvedFindings ?? [],
    notComparedFindings: auditResult.notComparedFindings ?? [],
    coverage: baselineUsed ? buildComparisonCoverage(auditResult) : undefined,
    schemaVersion: CURRENT_BASELINE_SCHEMA_VERSION,
    fingerprintVersion: CURRENT_FINGERPRINT_VERSION,
  };
}

export function findingLifecycle(finding: Finding): FindingLifecycleStatus {
  return finding.baseline?.status ?? "new";
}

export function findingRoute(finding: Finding): string {
  return finding.route ?? finding.routeName ?? finding.routeId ?? "Not available";
}

export function resolvedLocation(resolved: ResolvedFinding): string {
  return resolved.location.kind === "flow-checkpoint"
    ? `${resolved.location.flowId}/${resolved.location.checkpointId}`
    : resolved.location.route;
}

export function notComparedLocation(notCompared: NotComparedFinding): string {
  return notCompared.location.kind === "flow-checkpoint"
    ? `${notCompared.location.flowId}/${notCompared.location.checkpointId}`
    : notCompared.location.route;
}

function lifecycleBadge(status: FindingLifecycleStatus | "resolved" | "not-compared"): string {
  const label = lifecycleLabels[status];
  return `<p class="lifecycle-badge lifecycle-badge--${escapeHtml(status)}" aria-label="Lifecycle status: ${escapeHtml(label)}"><span class="lifecycle-badge__label">Lifecycle:</span> ${escapeHtml(label)}</p>`;
}

function dispositionText(disposition: FindingDisposition | undefined): string {
  return disposition ? dispositionLabels[disposition] : "";
}

function filterDatasetAttributes(values: {
  lifecycle: string;
  severity: string;
  project: string;
  route: string;
  flow: string;
  checkpoint: string;
  viewport: string;
  profile: string;
  source: string;
  rule: string;
  disposition: string;
  expired: string;
  owner: string;
  ticket: string;
}): string {
  return `data-finding
        data-lifecycle="${escapeHtml(values.lifecycle)}"
        data-severity="${escapeHtml(values.severity)}"
        data-project="${escapeHtml(values.project)}"
        data-route="${escapeHtml(values.route)}"
        data-flow="${escapeHtml(values.flow)}"
        data-checkpoint="${escapeHtml(values.checkpoint)}"
        data-viewport="${escapeHtml(values.viewport)}"
        data-profile="${escapeHtml(values.profile)}"
        data-source="${escapeHtml(values.source)}"
        data-rule="${escapeHtml(values.rule)}"
        data-disposition="${escapeHtml(values.disposition)}"
        data-expired="${escapeHtml(values.expired)}"
        data-owner="${escapeHtml(values.owner)}"
        data-ticket="${escapeHtml(values.ticket)}"`;
}

export function renderBaselineMetadata(finding: Finding): string {
  const baseline = finding.baseline;
  if (!baseline) return "";

  const classification = baseline.classification;
  const rows = [
    lifecycleBadge(findingLifecycle(finding)),
    baseline.previousSeverity
      ? detail("Previous severity", baseline.previousSeverity)
      : "",
    baseline.currentSeverity ? detail("Current severity", baseline.currentSeverity) : "",
    baseline.regressionReason
      ? detail("Regression reason", regressionLabels[baseline.regressionReason])
      : "",
    classification ? detail("Disposition", dispositionText(classification.disposition)) : "",
    classification ? detail("Classification reason", classification.reason) : "",
    classification?.owner ? detail("Owner", classification.owner) : "",
    classification?.ticket ? detail("Ticket", classification.ticket) : "",
    classification?.expiresAt ? detail("Expiry", classification.expiresAt) : "",
    classification?.reviewAt ? detail("Review date", classification.reviewAt) : "",
    baseline.classificationExpired !== undefined
      ? detail(
          "Expired state",
          baseline.classificationExpired ? "Expired" : "Active",
        )
      : "",
  ].join("");

  return `<div class="baseline-metadata">
        <h4>Baseline comparison</h4>
        <dl class="metadata">${rows}</dl>
      </div>`;
}

export function renderBaselineFindingDataAttributes(finding: Finding): string {
  const baseline = finding.baseline;
  const classification = baseline?.classification;
  const route = findingRoute(finding);
  return filterDatasetAttributes({
    lifecycle: findingLifecycle(finding),
    severity: finding.severity,
    project: finding.projectName,
    route,
    flow: finding.flowId ?? "",
    checkpoint: finding.checkpointId ?? "",
    viewport: finding.viewport ?? "Not available",
    profile: finding.profile,
    source: finding.source,
    rule: finding.ruleId,
    disposition: classification?.disposition ?? "",
    expired: baseline?.classificationExpired ? "yes" : "no",
    owner: classification?.owner ?? "",
    ticket: classification?.ticket ?? "",
  }).concat(` data-fingerprint="${escapeHtml(finding.fingerprint)}"`);
}

function renderResolvedFinding(resolved: ResolvedFinding, index: number): string {
  const location = resolvedLocation(resolved);
  const classification = resolved.classification;
  const viewport = resolved.location.viewport ?? "Not available";
  const profile =
    resolved.location.kind === "flow-checkpoint"
      ? resolved.location.profile
      : resolved.location.profile;

  return `<article class="finding finding--${resolved.previousSeverity} baseline-entry baseline-entry--resolved" ${filterDatasetAttributes(
    {
      lifecycle: "resolved",
      severity: resolved.previousSeverity,
      project: resolved.projectName,
      route: resolved.location.kind === "route" ? resolved.location.route : location,
      flow: resolved.location.kind === "flow-checkpoint" ? resolved.location.flowId : "",
      checkpoint:
        resolved.location.kind === "flow-checkpoint" ? resolved.location.checkpointId : "",
      viewport,
      profile,
      source: resolved.source,
      rule: resolved.ruleId,
      disposition: classification?.disposition ?? "",
      expired: "no",
      owner: classification?.owner ?? "",
      ticket: classification?.ticket ?? "",
    },
  )} data-fingerprint="${escapeHtml(resolved.fingerprint)}"
        aria-labelledby="resolved-${index}-title">
        <h3 id="resolved-${index}-title">${escapeHtml(resolved.snapshot?.title ?? resolved.ruleId)}</h3>
        ${lifecycleBadge("resolved")}
        <p class="severity">Previous severity: ${escapeHtml(resolved.previousSeverity)}</p>
        <dl class="metadata">
          ${detail("Rule ID", resolved.ruleId)}
          ${detail("Project", resolved.projectName)}
          ${detail("Location", location)}
          ${detail("Viewport", viewport)}
          ${detail("Profile", profile)}
          ${detail("Resolved at", resolved.resolvedAt)}
          ${detail("Fingerprint", resolved.fingerprint)}
          ${classification ? detail("Disposition", dispositionText(classification.disposition)) : ""}
          ${classification ? detail("Classification reason", classification.reason) : ""}
          ${classification?.owner ? detail("Owner", classification.owner) : ""}
          ${classification?.ticket ? detail("Ticket", classification.ticket) : ""}
          ${classification?.expiresAt ? detail("Expiry", classification.expiresAt) : ""}
          ${classification?.reviewAt ? detail("Review date", classification.reviewAt) : ""}
        </dl>
      </article>`;
}

function renderNotComparedFinding(notCompared: NotComparedFinding, index: number): string {
  const location = notComparedLocation(notCompared);
  const viewport = notCompared.location.viewport ?? "Not available";
  const profile = notCompared.location.profile;
  const reason =
    notCompared.reason === "coverage-missing"
      ? "Coverage missing in this audit"
      : "Not compared in this audit";

  return `<article class="finding finding--${notCompared.severity} baseline-entry baseline-entry--not-compared" ${filterDatasetAttributes(
    {
      lifecycle: "not-compared",
      severity: notCompared.severity,
      project: notCompared.projectName,
      route: notCompared.location.kind === "route" ? notCompared.location.route : location,
      flow:
        notCompared.location.kind === "flow-checkpoint" ? notCompared.location.flowId : "",
      checkpoint:
        notCompared.location.kind === "flow-checkpoint"
          ? notCompared.location.checkpointId
          : "",
      viewport,
      profile,
      source: notCompared.source,
      rule: notCompared.ruleId,
      disposition: "",
      expired: "no",
      owner: "",
      ticket: "",
    },
  )} data-fingerprint="${escapeHtml(notCompared.fingerprint)}"
        aria-labelledby="not-compared-${index}-title">
        <h3 id="not-compared-${index}-title">${escapeHtml(notCompared.ruleId)}</h3>
        ${lifecycleBadge("not-compared")}
        <p class="severity">Severity: ${escapeHtml(notCompared.severity)}</p>
        <p>${escapeHtml(reason)}</p>
        <dl class="metadata">
          ${detail("Rule ID", notCompared.ruleId)}
          ${detail("Project", notCompared.projectName)}
          ${detail("Location", location)}
          ${detail("Viewport", viewport)}
          ${detail("Profile", profile)}
          ${detail("Reason", notCompared.reason)}
          ${detail("Fingerprint", notCompared.fingerprint)}
        </dl>
      </article>`;
}

function renderCoverageList(label: string, values: string[]): string {
  if (values.length === 0) {
    return `<p class="muted">No ${escapeHtml(label.toLowerCase())} were compared.</p>`;
  }
  return `<ul class="coverage-list">${values
    .map((value) => `<li>${escapeHtml(value)}</li>`)
    .join("")}</ul>`;
}

function renderComparisonCoverage(coverage: ComparisonCoverage): string {
  const flowRows = coverage.comparedFlows
    .map(
      (flow) =>
        `<li>${escapeHtml(flow.flowId)}: ${escapeHtml(flow.checkpointIds.join(", "))}</li>`,
    )
    .join("");

  return `<div class="baseline-coverage">
      <h3 id="comparison-coverage-title">Comparison coverage</h3>
      <dl class="metadata metadata--inline">
        <div><dt>Compared projects</dt><dd>${coverage.comparedProjects.length}</dd></div>
        <div><dt>Compared profiles</dt><dd>${coverage.comparedProfiles.length}</dd></div>
        <div><dt>Compared viewports</dt><dd>${coverage.comparedViewports.length}</dd></div>
        <div><dt>Compared routes</dt><dd>${coverage.comparedRoutes.length}</dd></div>
        <div><dt>Compared flows</dt><dd>${coverage.comparedFlows.length}</dd></div>
        <div><dt>Excluded projects</dt><dd>${coverage.excludedProjects.length}</dd></div>
        <div><dt>Failed runs</dt><dd>${coverage.failedRuns.length}</dd></div>
        <div><dt>Skipped runs</dt><dd>${coverage.skippedRuns.length}</dd></div>
      </dl>
      <div class="coverage-details">
        <div><h4>Projects</h4>${renderCoverageList("projects", coverage.comparedProjects)}</div>
        <div><h4>Profiles</h4>${renderCoverageList("profiles", coverage.comparedProfiles)}</div>
        <div><h4>Viewports</h4>${renderCoverageList("viewports", coverage.comparedViewports)}</div>
        <div><h4>Routes</h4>${renderCoverageList("routes", coverage.comparedRoutes)}</div>
        <div><h4>Flows</h4>${
          coverage.comparedFlows.length === 0
            ? `<p class="muted">No flows were compared.</p>`
            : `<ul class="coverage-list">${flowRows}</ul>`
        }</div>
      </div>
    </div>`;
}

function renderSummaryCard(label: string, value: number, modifier?: string): string {
  const className = modifier ? `summary-card ${modifier}` : "summary-card";
  return `<div class="${className}"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

export function renderBaselineSummarySection(context: BaselineReportContext): string {
  const summary = context.baselineSummary;
  if (!summary?.baselineUsed) {
    return "";
  }

  return `<section id="baseline-summary" aria-labelledby="baseline-summary-title">
      <h2 id="baseline-summary-title">Baseline comparison</h2>
      <dl class="metadata metadata--inline">
        ${detail("Baseline used", summary.baselineUsed ? "Yes" : "No")}
        ${detail("Baseline path", summary.baselinePath)}
        ${detail("Schema version", context.schemaVersion)}
        ${detail("Fingerprint version", context.fingerprintVersion)}
      </dl>
      <div class="summary-grid baseline-summary-grid">
        ${renderSummaryCard("New findings", summary.newFindings, "summary-card--new")}
        ${renderSummaryCard("Known debt", summary.knownFindings, "summary-card--known")}
        ${renderSummaryCard("Regressions", summary.regressedFindings, "summary-card--regressed")}
        ${renderSummaryCard("Resolved", summary.resolvedFindings, "summary-card--resolved")}
        ${renderSummaryCard("Not compared", summary.notComparedFindings, "summary-card--not-compared")}
        ${renderSummaryCard("Expired classifications", summary.expiredClassifications, "summary-card--expired")}
      </div>
      ${context.coverage ? renderComparisonCoverage(context.coverage) : ""}
      <p class="muted">A baseline records known accessibility debt. It does not make that debt accessible or compliant.</p>
    </section>`;
}

function renderFindingSection(
  id: string,
  title: string,
  items: string[],
  emptyMessage: string,
): string {
  return `<section id="${id}" aria-labelledby="${id}-title">
      <h2 id="${id}-title">${escapeHtml(title)}</h2>
      ${
        items.length === 0
          ? `<div class="empty-state"><p class="muted">${escapeHtml(emptyMessage)}</p></div>`
          : `<div class="findings-list">${items.join("")}</div>`
      }
    </section>`;
}

export function renderBaselineLifecycleSections(
  context: BaselineReportContext,
  findings: Finding[],
  renderFinding: (finding: Finding, index: number) => string,
): string {
  if (!context.baselineUsed) {
    return "";
  }

  const newFindings = findings.filter((finding) => findingLifecycle(finding) === "new");
  const knownFindings = findings.filter((finding) => findingLifecycle(finding) === "known");
  const regressedFindings = findings.filter(
    (finding) => findingLifecycle(finding) === "regressed",
  );
  const classifiedFindings = findings.filter((finding) => finding.baseline?.classification);
  const expiredFindings = findings.filter(
    (finding) => finding.baseline?.classificationExpired === true,
  );

  return [
    renderFindingSection(
      "baseline-new",
      "New accessibility findings",
      newFindings.map((finding, index) => renderFinding(finding, index)),
      "No new accessibility findings compared to the baseline.",
    ),
    renderFindingSection(
      "baseline-known",
      "Known accessibility debt",
      knownFindings.map((finding, index) => renderFinding(finding, index)),
      "No known accessibility debt was matched in this audit.",
    ),
    renderFindingSection(
      "baseline-regressed",
      "Regressions",
      regressedFindings.map((finding, index) => renderFinding(finding, index)),
      "No regressions were detected compared to the baseline.",
    ),
    renderFindingSection(
      "baseline-resolved",
      "Resolved since baseline",
      context.resolvedFindings.map((finding, index) => renderResolvedFinding(finding, index)),
      "No baseline findings were resolved in compared coverage.",
    ),
    renderFindingSection(
      "baseline-not-compared",
      "Not compared in this audit",
      context.notComparedFindings.map((finding, index) =>
        renderNotComparedFinding(finding, index),
      ),
      "All baseline entries were compared in this audit.",
    ),
    renderFindingSection(
      "baseline-classified",
      "Classified findings",
      classifiedFindings.map((finding, index) => renderFinding(finding, index)),
      "No classified findings are recorded for this audit.",
    ),
    renderFindingSection(
      "baseline-expired",
      "Expired classifications",
      expiredFindings.map((finding, index) => renderFinding(finding, index)),
      "No expired classifications were detected in this audit.",
    ),
  ].join("");
}

export function renderBaselineNavLinks(context: BaselineReportContext): string {
  if (!context.baselineUsed) {
    return "";
  }
  return `<li><a href="#baseline-summary">Baseline comparison</a></li>
          <li><a href="#baseline-new">New findings</a></li>
          <li><a href="#baseline-known">Known debt</a></li>
          <li><a href="#baseline-regressed">Regressions</a></li>
          <li><a href="#baseline-resolved">Resolved</a></li>
          <li><a href="#baseline-not-compared">Not compared</a></li>
          <li><a href="#baseline-classified">Classified</a></li>
          <li><a href="#baseline-expired">Expired</a></li>`;
}

export function renderBaselineFilters(
  findings: Finding[],
  context: BaselineReportContext,
): string {
  if (!context.baselineUsed) {
    return "";
  }

  const allFindings = findings;
  const lifecycles = unique([
    ...allFindings.map((finding) => findingLifecycle(finding)),
    ...context.resolvedFindings.map(() => "resolved"),
    ...context.notComparedFindings.map(() => "not-compared"),
  ]);
  const dispositions = unique(
    allFindings.map((finding) => finding.baseline?.classification?.disposition),
  );
  const owners = unique(
    allFindings.map((finding) => finding.baseline?.classification?.owner),
  );
  const tickets = unique(
    allFindings.map((finding) => finding.baseline?.classification?.ticket),
  );

  return [
    filter("Lifecycle", "lifecycle", lifecycles, "All lifecycle states"),
    filter("Disposition", "disposition", dispositions, "All dispositions"),
    filter("Expired", "expired", ["yes", "no"], "Any expiry state"),
    filter("Owner", "owner", owners, "All owners"),
    filter("Ticket", "ticket", tickets, "All tickets"),
  ].join("");
}
