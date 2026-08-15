import type { BaselineFile, BaselineEntry } from "@a11yst/types";
import type { CompareBaselineResult } from "./compare.js";
import { appendHistory, sortEntries } from "./create.js";

export interface BaselineUpdatePreview {
  added: BaselineEntry[];
  removed: BaselineEntry[];
  unchanged: BaselineEntry[];
  regressed: BaselineEntry[];
  hasChanges: boolean;
}

export function previewBaselineUpdate(
  baseline: BaselineFile,
  comparison: CompareBaselineResult,
): BaselineUpdatePreview {
  const baselineByFingerprint = new Map(
    baseline.entries.map((entry) => [entry.fingerprint, entry]),
  );

  const added: BaselineEntry[] = [];
  const removed: BaselineEntry[] = [];
  const unchanged: BaselineEntry[] = [];
  const regressed: BaselineEntry[] = [];

  for (const finding of comparison.findings) {
    const state = finding.baseline;
    if (!state) continue;
    if (state.status === "new") {
      const existing = baselineByFingerprint.get(finding.fingerprint);
      added.push(
        existing ?? {
          fingerprint: finding.fingerprint,
          fingerprintVersion: finding.fingerprintVersion ?? "1",
          ruleId: finding.ruleId,
          source: finding.source,
          projectName: finding.projectName,
          location: {
            kind: finding.flowId && finding.checkpointId ? "flow-checkpoint" : "route",
            ...(finding.flowId && finding.checkpointId
              ? {
                  flowId: finding.flowId,
                  checkpointId: finding.checkpointId,
                  profile: finding.profile,
                  viewport: finding.viewport,
                }
              : {
                  route: finding.route ?? "",
                  routeId: finding.routeId,
                  profile: finding.profile,
                  viewport: finding.viewport,
                }),
          } as BaselineEntry["location"],
          severity: finding.severity,
          firstSeenAt: baseline.updatedAt,
          lastSeenAt: baseline.updatedAt,
          snapshot: { title: finding.title, profile: finding.profile },
        },
      );
    } else if (state.status === "regressed") {
      const entry = baselineByFingerprint.get(finding.fingerprint);
      if (entry) {
        regressed.push(entry);
      }
    } else {
      const entry = baselineByFingerprint.get(finding.fingerprint);
      if (entry) {
        unchanged.push(entry);
      }
    }
  }

  for (const resolved of comparison.resolvedFindings) {
    const entry = baselineByFingerprint.get(resolved.fingerprint);
    if (entry) {
      removed.push(entry);
    }
  }

  return {
    added,
    removed,
    unchanged,
    regressed,
    hasChanges: added.length > 0 || removed.length > 0,
  };
}

export interface ApplyBaselineUpdateOptions {
  acceptNew?: boolean;
  removeResolved?: boolean;
  now?: string;
}

export function applyBaselineUpdate(
  baseline: BaselineFile,
  comparison: CompareBaselineResult,
  options: ApplyBaselineUpdateOptions,
): BaselineFile | undefined {
  const preview = previewBaselineUpdate(baseline, comparison);
  if (!preview.hasChanges) {
    return undefined;
  }

  if (preview.regressed.length > 0 && options.acceptNew) {
    // Regressions are never silently accepted.
  }

  const now = options.now ?? new Date().toISOString();
  let entries = [...baseline.entries];

  if (options.removeResolved) {
    const removeFingerprints = new Set(
      comparison.resolvedFindings.map((finding) => finding.fingerprint),
    );
    entries = entries.filter((entry) => !removeFingerprints.has(entry.fingerprint));
  }

  if (options.acceptNew) {
    const existing = new Set(entries.map((entry) => entry.fingerprint));
    for (const finding of comparison.findings) {
      if (finding.baseline?.status !== "new") {
        continue;
      }
      if (existing.has(finding.fingerprint)) {
        continue;
      }
      entries.push({
        fingerprint: finding.fingerprint,
        fingerprintVersion: finding.fingerprintVersion ?? "1",
        ruleId: finding.ruleId,
        source: finding.source,
        projectName: finding.projectName,
        location:
          finding.flowId && finding.checkpointId
            ? {
                kind: "flow-checkpoint",
                flowId: finding.flowId,
                checkpointId: finding.checkpointId,
                profile: finding.profile,
                viewport: finding.viewport,
              }
            : {
                kind: "route",
                route: finding.route ?? "",
                routeId: finding.routeId,
                profile: finding.profile,
                viewport: finding.viewport,
              },
        severity: finding.severity,
        firstSeenAt: now,
        lastSeenAt: now,
        snapshot: {
          title: finding.title,
          target: finding.target.length > 0 ? [...finding.target] : undefined,
          route: finding.route,
          routeId: finding.routeId,
          flowId: finding.flowId,
          checkpointId: finding.checkpointId,
          profile: finding.profile,
          viewport: finding.viewport,
          confidence: finding.confidence,
        },
        history: appendHistory(
          { fingerprint: finding.fingerprint } as BaselineEntry,
          "accepted",
          now,
        ),
      });
    }
  }

  if (!options.acceptNew && !options.removeResolved) {
    return undefined;
  }

  return {
    ...baseline,
    updatedAt: now,
    entries: sortEntries(entries),
  };
}
