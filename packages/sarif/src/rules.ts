import type { Finding } from "@a11yst/types";
import type { SarifReportingDescriptor, SarifGenerationDiagnostic } from "./types.js";
import { mapSeverityToSarifLevel } from "./severity.js";
import {
  isValidHelpUri,
  MAX_FULL_DESCRIPTION_LENGTH,
  MAX_SHORT_DESCRIPTION_LENGTH,
  normalizeRuleName,
  pushTruncatedDiagnostic,
  sanitizeText,
  truncateText,
} from "./text.js";

type RuleAccumulator = {
  ruleId: string;
  descriptor: SarifReportingDescriptor;
  completeness: number;
};

export function buildRules(
  findings: Finding[],
  diagnostics: SarifGenerationDiagnostic[],
): SarifReportingDescriptor[] {
  const byId = new Map<string, RuleAccumulator>();

  for (const finding of findings) {
    const existing = byId.get(finding.ruleId);
    const candidate = buildRuleDescriptor(finding, diagnostics);
    if (!existing) {
      byId.set(finding.ruleId, {
        ruleId: finding.ruleId,
        descriptor: candidate,
        completeness: descriptorCompleteness(candidate),
      });
      continue;
    }

    const candidateScore = descriptorCompleteness(candidate);
    if (candidateScore > existing.completeness) {
      diagnostics.push({
        code: "duplicate-rule",
        level: "warning",
        message: `Rule "${finding.ruleId}" had conflicting metadata; kept the more complete descriptor.`,
        ruleId: finding.ruleId,
      });
      byId.set(finding.ruleId, {
        ruleId: finding.ruleId,
        descriptor: candidate,
        completeness: candidateScore,
      });
    } else if (!descriptorsCompatible(existing.descriptor, candidate)) {
      diagnostics.push({
        code: "duplicate-rule",
        level: "warning",
        message: `Rule "${finding.ruleId}" had conflicting metadata; kept the existing descriptor.`,
        ruleId: finding.ruleId,
      });
    }
  }

  return [...byId.values()]
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId))
    .map((entry) => entry.descriptor);
}

function buildRuleDescriptor(
  finding: Finding,
  diagnostics: SarifGenerationDiagnostic[],
): SarifReportingDescriptor {
  const shortSource = finding.description ?? finding.title;
  const short = truncateText(shortSource, MAX_SHORT_DESCRIPTION_LENGTH);
  if (short.truncated) {
    pushTruncatedDiagnostic(diagnostics, { ruleId: finding.ruleId });
  }

  const fullSource = finding.description ?? finding.title;
  const full = truncateText(fullSource, MAX_FULL_DESCRIPTION_LENGTH);
  if (full.truncated && full.text !== short.text) {
    pushTruncatedDiagnostic(diagnostics, { ruleId: finding.ruleId });
  }

  const helpText = truncateText(finding.description ?? finding.title, MAX_SHORT_DESCRIPTION_LENGTH);
  if (helpText.truncated) {
    pushTruncatedDiagnostic(diagnostics, { ruleId: finding.ruleId });
  }

  const descriptor: SarifReportingDescriptor = {
    id: finding.ruleId,
    name: normalizeRuleName(finding.ruleId, finding.title),
    shortDescription: { text: short.text },
    fullDescription: { text: full.text },
    help: { text: helpText.text },
    defaultConfiguration: { level: mapSeverityToSarifLevel(finding.severity) },
    properties: buildRuleProperties(finding),
  };

  if (finding.helpUrl && isValidHelpUri(finding.helpUrl)) {
    descriptor.helpUri = finding.helpUrl;
  }

  return descriptor;
}

function buildRuleProperties(finding: Finding): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    "a11yst.source": finding.source,
  };

  if (finding.standards.length > 0) {
    properties["a11yst.standards"] = [...finding.standards].sort();
  }
  if (finding.confidence) {
    properties["a11yst.confidence"] = finding.confidence;
  }
  if (finding.automation) {
    properties["a11yst.automation"] = finding.automation;
  }

  const tags = buildTags(finding);
  if (tags.length > 0) {
    properties.tags = tags;
  }

  return properties;
}

function buildTags(finding: Finding): string[] {
  const tags = new Set<string>(["accessibility"]);
  for (const standard of finding.standards) {
    const normalized = sanitizeText(standard).toLowerCase();
    if (normalized) {
      tags.add(normalized);
    }
  }
  if (finding.source === "axe") {
    tags.add("axe");
  }
  tags.add(sanitizeText(finding.profile).toLowerCase());
  return [...tags].filter(Boolean).sort();
}

function descriptorCompleteness(descriptor: SarifReportingDescriptor): number {
  let score = 0;
  if (descriptor.name) score += 1;
  if (descriptor.shortDescription?.text) score += 2;
  if (descriptor.fullDescription?.text) score += 2;
  if (descriptor.help?.text) score += 1;
  if (descriptor.helpUri) score += 1;
  const props = descriptor.properties ?? {};
  score += Object.keys(props).length;
  return score;
}

function descriptorsCompatible(a: SarifReportingDescriptor, b: SarifReportingDescriptor): boolean {
  return (
    a.defaultConfiguration?.level === b.defaultConfiguration?.level &&
    (a.shortDescription?.text ?? "") === (b.shortDescription?.text ?? "")
  );
}

export function buildRuleIndexMap(rules: SarifReportingDescriptor[]): Map<string, number> {
  const map = new Map<string, number>();
  rules.forEach((rule, index) => {
    map.set(rule.id, index);
  });
  return map;
}
