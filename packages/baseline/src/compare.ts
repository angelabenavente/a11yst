import type {
  AuditExecutionResult,
  BaselineComparisonArtifact,
  BaselineEntry,
  BaselineFile,
  BaselineSummary,
  Finding,
  FindingBaselineState,
  NotComparedFinding,
  RegressionReason,
  ResolvedFinding,
} from "@a11yst/types";
import { type Clock, isClassificationExpired, systemClock } from "./clock.js";
import { buildComparisonCoverage, entryInComparisonCoverage } from "./coverage.js";
import { findingLocation, fingerprintVersionOf } from "./location.js";
import {
  severityDecreased,
  severityIncreased,
} from "./severity.js";

const CONFIDENCE_ORDER = ["low", "medium", "high"] as const;

export interface CompareBaselineOptions {
  baselinePath?: string;
  applyClassifications?: boolean;
  clock?: Clock;
  comparedAt?: string;
}

export interface CompareBaselineResult {
  findings: Finding[];
  resolvedFindings: ResolvedFinding[];
  notComparedFindings: NotComparedFinding[];
  summary: BaselineSummary;
  artifact: BaselineComparisonArtifact;
}

function baselineKey(entry: BaselineEntry): string {
  return `${entry.fingerprintVersion}:${entry.fingerprint}`;
}

function findingKey(finding: Finding): string {
  return `${fingerprintVersionOf(finding)}:${finding.fingerprint}`;
}

function countDispositions(entries: BaselineEntry[]): BaselineSummary["dispositions"] {
  const counts = {
    falsePositive: 0,
    acceptedRisk: 0,
    thirdParty: 0,
    notApplicable: 0,
    manualReview: 0,
  };

  for (const entry of entries) {
    switch (entry.classification?.disposition) {
      case "false-positive":
        counts.falsePositive += 1;
        break;
      case "accepted-risk":
        counts.acceptedRisk += 1;
        break;
      case "third-party":
        counts.thirdParty += 1;
        break;
      case "not-applicable":
        counts.notApplicable += 1;
        break;
      case "manual-review":
        counts.manualReview += 1;
        break;
    }
  }

  return counts;
}

function confidenceIncreased(
  previous: "low" | "medium" | "high" | undefined,
  current: "low" | "medium" | "high" | undefined,
): boolean {
  if (!previous || !current) {
    return false;
  }
  return CONFIDENCE_ORDER.indexOf(current) > CONFIDENCE_ORDER.indexOf(previous);
}

function detectRegression(
  entry: BaselineEntry,
  finding: Finding,
  clock: Clock,
): RegressionReason | undefined {
  if (
    entry.lifecycle?.lastStatus === "resolved" ||
    entry.lifecycle?.resolvedAt
  ) {
    return "returned-after-resolution";
  }

  const classification = entry.classification;
  if (
    classification &&
    (classification.expiresAt || classification.reviewAt) &&
    isClassificationExpired(classification.expiresAt ?? classification.reviewAt, clock.now())
  ) {
    return "classification-expired";
  }

  if (severityIncreased(entry.severity, finding.severity)) {
    return "severity-increased";
  }

  if (
    finding.source === "a11yst" &&
    confidenceIncreased(entry.snapshot.confidence, finding.confidence)
  ) {
    return "confidence-increased";
  }

  return undefined;
}

export function compareBaselineWithAudit(
  baseline: BaselineFile,
  result: AuditExecutionResult,
  options: CompareBaselineOptions,
): CompareBaselineResult {
  const clock = options.clock ?? systemClock;
  const comparedAt = options.comparedAt ?? clock.now().toISOString();
  const applyClassifications = options.applyClassifications ?? true;
  const coverage = buildComparisonCoverage(result);

  const baselineMap = new Map<string, BaselineEntry>();
  for (const entry of baseline.entries) {
    baselineMap.set(baselineKey(entry), entry);
  }

  const currentFingerprints = new Set<string>();
  const updatedFindings: Finding[] = [];
  const artifactNew: BaselineComparisonArtifact["new"] = [];
  const artifactKnown: BaselineComparisonArtifact["known"] = [];
  const artifactRegressed: BaselineComparisonArtifact["regressed"] = [];
  const expiredClassifications: BaselineComparisonArtifact["expiredClassifications"] = [];

  let newCount = 0;
  let knownCount = 0;
  let regressedCount = 0;
  let expiredCount = 0;

  for (const finding of result.findings) {
    const key = findingKey(finding);
    currentFingerprints.add(key);
    const entry = baselineMap.get(key);

    if (!entry) {
      newCount += 1;
      const baselineState: FindingBaselineState = {
        status: "new",
        baselineFingerprint: finding.fingerprint,
        currentSeverity: finding.severity,
      };
      updatedFindings.push({ ...finding, baseline: baselineState });
      artifactNew.push({
        fingerprint: finding.fingerprint,
        ruleId: finding.ruleId,
        severity: finding.severity,
        projectName: finding.projectName,
        location: findingLocation(finding),
      });
      continue;
    }

    const regressionReason = detectRegression(entry, finding, clock);
    const classificationExpired =
      Boolean(entry.classification) &&
      isClassificationExpired(
        entry.classification?.expiresAt ?? entry.classification?.reviewAt,
        clock.now(),
      );

    if (classificationExpired && entry.classification) {
      expiredCount += 1;
      expiredClassifications.push({
        fingerprint: entry.fingerprint,
        disposition: entry.classification.disposition,
        expiresAt: entry.classification.expiresAt ?? entry.classification.reviewAt ?? "",
      });
    }

    if (regressionReason) {
      regressedCount += 1;
      const baselineState: FindingBaselineState = {
        status: "regressed",
        baselineFingerprint: entry.fingerprint,
        previousSeverity: entry.severity,
        currentSeverity: finding.severity,
        classification: applyClassifications ? entry.classification : undefined,
        classificationExpired,
        regressionReason,
      };
      updatedFindings.push({ ...finding, baseline: baselineState });
      artifactRegressed.push({
        fingerprint: finding.fingerprint,
        ruleId: finding.ruleId,
        severity: finding.severity,
        regressionReason,
      });
      continue;
    }

    knownCount += 1;
    const baselineState: FindingBaselineState = {
      status: "known",
      baselineFingerprint: entry.fingerprint,
      previousSeverity: severityDecreased(entry.severity, finding.severity)
        ? entry.severity
        : undefined,
      currentSeverity: finding.severity,
      classification: applyClassifications ? entry.classification : undefined,
      classificationExpired,
    };
    updatedFindings.push({ ...finding, baseline: baselineState });
    artifactKnown.push({
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
      severity: finding.severity,
    });
  }

  const resolvedFindings: ResolvedFinding[] = [];
  const notComparedFindings: NotComparedFinding[] = [];

  for (const entry of baseline.entries) {
    const key = baselineKey(entry);
    if (currentFingerprints.has(key)) {
      continue;
    }

    if (!entryInComparisonCoverage(entry, coverage)) {
      notComparedFindings.push({
        fingerprint: entry.fingerprint,
        ruleId: entry.ruleId,
        source: entry.source,
        projectName: entry.projectName,
        location: entry.location,
        severity: entry.severity,
        reason: "coverage-missing",
      });
      continue;
    }

    resolvedFindings.push({
      fingerprint: entry.fingerprint,
      fingerprintVersion: entry.fingerprintVersion,
      ruleId: entry.ruleId,
      source: entry.source,
      projectName: entry.projectName,
      location: entry.location,
      previousSeverity: entry.severity,
      ...(entry.classification ? { classification: entry.classification } : {}),
      resolvedAt: comparedAt,
      snapshot: entry.snapshot,
    });
  }

  const summary: BaselineSummary = {
    baselineUsed: true,
    baselinePath: options.baselinePath,
    currentFindings: result.findings.length,
    newFindings: newCount,
    knownFindings: knownCount,
    regressedFindings: regressedCount,
    resolvedFindings: resolvedFindings.length,
    notComparedFindings: notComparedFindings.length,
    expiredClassifications: expiredCount,
    dispositions: countDispositions(baseline.entries),
  };

  const artifact: BaselineComparisonArtifact = {
    schemaVersion: baseline.schemaVersion,
    fingerprintVersion: baseline.fingerprintVersion,
    baselinePath: options.baselinePath ?? ".a11yst/baseline.json",
    comparedAt,
    coverage,
    summary,
    new: artifactNew,
    known: artifactKnown,
    regressed: artifactRegressed,
    resolved: resolvedFindings,
    notCompared: notComparedFindings,
    expiredClassifications,
    diagnostics: [],
  };

  return {
    findings: updatedFindings,
    resolvedFindings,
    notComparedFindings,
    summary,
    artifact,
  };
}

export function emptyBaselineSummary(): BaselineSummary {
  return {
    baselineUsed: false,
    currentFindings: 0,
    newFindings: 0,
    knownFindings: 0,
    regressedFindings: 0,
    resolvedFindings: 0,
    notComparedFindings: 0,
    expiredClassifications: 0,
    dispositions: {
      falsePositive: 0,
      acceptedRisk: 0,
      thirdParty: 0,
      notApplicable: 0,
      manualReview: 0,
    },
  };
}
