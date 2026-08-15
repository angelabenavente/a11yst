import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuditRunResult, FocusStep, ProfileSnapshot } from "@a11yst/types";

export interface FocusSequenceEvidence {
  forwardSteps: FocusStep[];
  backwardSteps: FocusStep[];
  stopReason?: string;
}

export interface LayoutComparisonEvidence {
  baseline?: ProfileSnapshot;
  scaled?: ProfileSnapshot;
}

export interface LoadedProfileEvidence {
  focusSequence?: FocusSequenceEvidence;
  layoutComparison?: LayoutComparisonEvidence;
  beforeScreenshot?: string;
  afterScreenshot?: string;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function evidencePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^(\.\/|\/)+/, "");
  const path = normalized
    .split("/")
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `../${path || "evidence"}`;
}

function runRouteLabel(run: AuditRunResult): string {
  return run.route ?? run.routeName ?? run.routeId ?? "route";
}

function findDefaultScreenshot(
  run: AuditRunResult,
  runs: AuditRunResult[],
): string | undefined {
  return runs.find(
    (candidate) =>
      candidate.profile === "default" &&
      candidate.projectName === run.projectName &&
      candidate.routeId === run.routeId &&
      candidate.viewport?.name === run.viewport?.name &&
      candidate.status === "completed",
  )?.evidence?.screenshot;
}

export async function loadProfileEvidenceForReport(
  outputDirectory: string,
  runs: AuditRunResult[],
): Promise<Map<string, LoadedProfileEvidence>> {
  const loaded = new Map<string, LoadedProfileEvidence>();

  for (const run of runs) {
    if (run.status !== "completed") continue;

    const bundle: LoadedProfileEvidence = {};

    for (const ref of run.profileEvidence ?? []) {
      if (!ref.path) continue;
      try {
        const raw = await readFile(join(outputDirectory, ref.path), "utf8");
        const parsed = JSON.parse(raw) as unknown;
        if (ref.kind === "focus-sequence") {
          bundle.focusSequence = parsed as FocusSequenceEvidence;
        }
        if (ref.kind === "layout-comparison") {
          bundle.layoutComparison = parsed as LayoutComparisonEvidence;
        }
      } catch {
        // Structured evidence is optional for report rendering.
      }
    }

    if (run.profile === "large-text") {
      bundle.afterScreenshot = run.evidence?.screenshot;
      bundle.beforeScreenshot =
        bundle.layoutComparison?.baseline?.screenshot ??
        findDefaultScreenshot(run, runs);
    }

    if (
      bundle.focusSequence ||
      bundle.layoutComparison ||
      bundle.beforeScreenshot ||
      bundle.afterScreenshot
    ) {
      loaded.set(run.runId, bundle);
    }
  }

  return loaded;
}

function formatTarget(target: string[] | undefined): string {
  if (!target || target.length === 0) return "(no active element)";
  return target.join(" ");
}

function formatBoolean(value: boolean): string {
  return value ? "yes" : "no";
}

function renderFocusStepRows(steps: FocusStep[], direction: "forward" | "backward"): string {
  const filtered = steps.filter((step) => step.direction === direction);
  if (filtered.length === 0) {
    return `<tr><td colspan="7" class="muted">No ${direction} steps recorded.</td></tr>`;
  }

  return filtered
    .map(
      (step) => `<tr>
          <td>${escapeHtml(String(step.index))}</td>
          <td><code>${escapeHtml(formatTarget(step.target))}</code></td>
          <td>${escapeHtml(step.role ?? "—")}</td>
          <td>${escapeHtml(step.accessibleName ?? "—")}</td>
          <td>${escapeHtml(formatBoolean(step.visible))}</td>
          <td>${escapeHtml(formatBoolean(step.inViewport))}</td>
          <td>${escapeHtml(
            step.tabindex === undefined ? "—" : String(step.tabindex),
          )}</td>
        </tr>`,
    )
    .join("");
}

export function renderFocusSequenceBlock(
  run: AuditRunResult,
  evidence: FocusSequenceEvidence,
): string {
  const route = runRouteLabel(run);
  const forwardCount = evidence.forwardSteps.length;
  const backwardCount = evidence.backwardSteps.length;

  return `<section class="profile-evidence profile-evidence--keyboard" aria-labelledby="focus-${escapeHtml(run.runId)}">
      <h4 id="focus-${escapeHtml(run.runId)}">Keyboard focus sequence</h4>
      <p class="muted">${escapeHtml(run.projectName)} · ${escapeHtml(route)} · ${escapeHtml(
        run.viewport?.name ?? "default",
      )}</p>
      <dl class="metadata metadata--inline">
        <div><dt>Forward steps</dt><dd>${forwardCount}</dd></div>
        <div><dt>Backward sample</dt><dd>${backwardCount}</dd></div>
        <div><dt>Stop reason</dt><dd>${escapeHtml(evidence.stopReason ?? "completed")}</dd></div>
      </dl>
      <h5>Forward Tab sequence</h5>
      <div class="table-wrap" tabindex="0">
        <table class="focus-sequence-table">
          <caption class="visually-hidden">Forward keyboard focus steps for ${escapeHtml(route)}</caption>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Target</th>
              <th scope="col">Role</th>
              <th scope="col">Accessible name</th>
              <th scope="col">Visible</th>
              <th scope="col">In viewport</th>
              <th scope="col">tabindex</th>
            </tr>
          </thead>
          <tbody>${renderFocusStepRows(evidence.forwardSteps, "forward")}</tbody>
        </table>
      </div>
      <h5>Backward Shift+Tab sample</h5>
      <div class="table-wrap" tabindex="0">
        <table class="focus-sequence-table">
          <caption class="visually-hidden">Backward keyboard focus sample for ${escapeHtml(route)}</caption>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Target</th>
              <th scope="col">Role</th>
              <th scope="col">Accessible name</th>
              <th scope="col">Visible</th>
              <th scope="col">In viewport</th>
              <th scope="col">tabindex</th>
            </tr>
          </thead>
          <tbody>${renderFocusStepRows(evidence.backwardSteps, "backward")}</tbody>
        </table>
      </div>
    </section>`;
}

function renderScreenshotFigure(
  path: string | undefined,
  label: string,
  alt: string,
): string {
  if (!path) {
    return `<figure class="comparison-shot comparison-shot--missing">
        <figcaption>${escapeHtml(label)}</figcaption>
        <p class="muted">Screenshot not available.</p>
      </figure>`;
  }
  return `<figure class="comparison-shot">
      <figcaption>${escapeHtml(label)}</figcaption>
      <img class="evidence" src="${escapeHtml(evidencePath(path))}" alt="${escapeHtml(alt)}">
    </figure>`;
}

function formatDimensions(snapshot: ProfileSnapshot | undefined): string {
  if (!snapshot) return "Not available";
  const parts = [
    snapshot.clientWidth !== undefined && snapshot.clientHeight !== undefined
      ? `viewport ${snapshot.clientWidth}×${snapshot.clientHeight}px`
      : undefined,
    snapshot.scrollWidth !== undefined && snapshot.scrollHeight !== undefined
      ? `scroll ${snapshot.scrollWidth}×${snapshot.scrollHeight}px`
      : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Not available";
}

export function renderLargeTextComparisonBlock(
  run: AuditRunResult,
  evidence: LoadedProfileEvidence,
): string {
  const route = runRouteLabel(run);
  const scale =
    typeof run.profileMetadata?.scale === "number"
      ? `${run.profileMetadata.scale * 100}%`
      : "200%";
  const strategy =
    typeof run.profileMetadata?.strategy === "string"
      ? run.profileMetadata.strategy
      : "injected-text-scale";
  const baseline = evidence.layoutComparison?.baseline;
  const scaled = evidence.layoutComparison?.scaled;

  return `<section class="profile-evidence profile-evidence--large-text" aria-labelledby="layout-${escapeHtml(run.runId)}">
      <h4 id="layout-${escapeHtml(run.runId)}">Large-text layout comparison</h4>
      <p class="muted">${escapeHtml(run.projectName)} · ${escapeHtml(route)} · ${escapeHtml(
        run.viewport?.name ?? "default",
      )}</p>
      <dl class="metadata metadata--inline">
        <div><dt>Strategy</dt><dd>${escapeHtml(strategy)}</dd></div>
        <div><dt>Text scale</dt><dd>${escapeHtml(scale)}</dd></div>
        <div><dt>Default dimensions</dt><dd>${escapeHtml(formatDimensions(baseline))}</dd></div>
        <div><dt>Scaled dimensions</dt><dd>${escapeHtml(formatDimensions(scaled))}</dd></div>
      </dl>
      <div class="comparison-grid" role="group" aria-label="Default and large-text screenshots">
        ${renderScreenshotFigure(
          evidence.beforeScreenshot,
          "Default profile (before)",
          `Default profile screenshot for ${run.projectName} at ${route}`,
        )}
        ${renderScreenshotFigure(
          evidence.afterScreenshot,
          `Large text at ${scale} (after)`,
          `Large-text profile screenshot for ${run.projectName} at ${route}`,
        )}
      </div>
    </section>`;
}

export function renderProfileEvidenceSection(
  runs: AuditRunResult[],
  loaded: Map<string, LoadedProfileEvidence>,
): string {
  const blocks: string[] = [];

  for (const run of runs) {
    const evidence = loaded.get(run.runId);
    if (!evidence) continue;

    if (evidence.focusSequence) {
      blocks.push(renderFocusSequenceBlock(run, evidence.focusSequence));
    }
    if (run.profile === "large-text") {
      blocks.push(renderLargeTextComparisonBlock(run, evidence));
    }
  }

  if (blocks.length === 0) {
    return `<p class="muted">No structured profile evidence was recorded for this audit.</p>`;
  }

  return `<div class="profile-evidence-list">${blocks.join("")}</div>`;
}
