import type { ExistingSourceLocation, Finding } from "@a11yst/types";
import {
  MAX_ATTRIBUTES,
  MAX_ATTRIBUTE_VALUE_LENGTH,
  MAX_SELECTOR_LENGTH,
  MAX_TEXT_LENGTH,
} from "./constants.js";
import type { SourceAnalysisProject } from "@a11yst/types";
import { normalizeFramework } from "./framework.js";

const ALLOWED_ATTRIBUTE_NAMES = new Set([
  "id",
  "role",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "alt",
  "title",
  "name",
  "type",
  "data-testid",
  "data-test",
  "data-cy",
  "class",
]);

const SENSITIVE_PATTERN = /password|token|authorization|cookie|secret/i;

function stripControl(value: string): string {
  let result = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 0 || (code >= 1 && code <= 31) || code === 127) {
      continue;
    }
    result += char;
  }
  return result.trim();
}

function sanitizeLimitedText(value: string | undefined, max: number): string | undefined {
  if (!value) {
    return undefined;
  }
  const sanitized = stripControl(value);
  if (!sanitized || SENSITIVE_PATTERN.test(sanitized)) {
    return undefined;
  }
  return sanitized.slice(0, max);
}

function sanitizeSelector(value: string | undefined): string | undefined {
  const sanitized = sanitizeLimitedText(value, MAX_SELECTOR_LENGTH);
  if (!sanitized || sanitized.includes("<") || sanitized.includes(">")) {
    return undefined;
  }
  return sanitized;
}

function parseSimpleSelector(selector: string): {
  tagName?: string;
  elementId?: string;
  classNames?: string[];
} {
  const trimmed = selector.trim();
  const tagMatch = /^([a-zA-Z][\w-]*)/.exec(trimmed);
  const idMatch = /#([\w-]+)/.exec(trimmed);
  const classMatches = [...trimmed.matchAll(/\.([\w-]+)/g)].map((match) => match[1]!);
  return {
    tagName: tagMatch?.[1]?.toLowerCase(),
    elementId: idMatch?.[1],
    classNames: classMatches.length > 0 ? [...new Set(classMatches)].sort() : undefined,
  };
}

function readExistingSourceLocation(finding: Finding): ExistingSourceLocation | undefined {
  const extension = finding as Finding & {
    sourceLocation?: ExistingSourceLocation;
  };
  const source = extension.sourceLocation;
  if (!source) {
    return undefined;
  }
  return {
    uri: source.uri,
    startLine: source.startLine,
    ...(source.startColumn !== undefined ? { startColumn: source.startColumn } : {}),
    ...(source.endLine !== undefined ? { endLine: source.endLine } : {}),
    ...(source.endColumn !== undefined ? { endColumn: source.endColumn } : {}),
  };
}

export function hasExactExistingSourceLocation(finding: Finding): boolean {
  const existing = readExistingSourceLocation(finding);
  return existing !== undefined && existing.uri.length > 0 && existing.startLine > 0;
}

export function createSourceMappingEvidenceFromFinding(
  finding: Finding,
  project?: SourceAnalysisProject,
): Record<string, unknown> {
  const selector = sanitizeSelector(finding.target[finding.target.length - 1] ?? finding.target.join(" "));
  const parsed = selector ? parseSimpleSelector(selector) : {};
  const attributes: Record<string, string> = {};
  if (parsed.elementId) {
    attributes.id = parsed.elementId.slice(0, MAX_ATTRIBUTE_VALUE_LENGTH);
  }
  if (parsed.classNames) {
    attributes.class = parsed.classNames.join(" ").slice(0, MAX_ATTRIBUTE_VALUE_LENGTH);
  }

  const evidence: Record<string, unknown> = {
    ...(selector ? { selector } : {}),
    ...(parsed.tagName ? { tagName: parsed.tagName } : {}),
    ...(parsed.elementId ? { elementId: parsed.elementId } : {}),
    ...(parsed.classNames ? { classNames: parsed.classNames } : {}),
    ...(finding.route ? { route: finding.route.slice(0, 1024) } : {}),
    ...(finding.flowId ? { flow: finding.flowId.slice(0, 256) } : {}),
    ...(finding.checkpointId ? { checkpoint: finding.checkpointId.slice(0, 256) } : {}),
    ...(project ? { scopeIds: [project.id] } : {}),
    ...(Object.keys(attributes).length > 0 ? { attributes: Object.fromEntries(Object.entries(attributes).slice(0, MAX_ATTRIBUTES)) } : {}),
  };

  const existing = readExistingSourceLocation(finding);
  if (existing) {
    evidence.existingSourceLocation = existing;
  }

  const accessibleName = sanitizeLimitedText(finding.title, MAX_TEXT_LENGTH);
  if (accessibleName) {
    evidence.accessibleName = accessibleName;
  }

  return evidence;
}

export function createRecommendationInputFromFinding(
  finding: Finding,
  project: SourceAnalysisProject | undefined,
  sourceMapping: Finding["sourceMapping"],
  sourceRanking: Finding["sourceRanking"],
) {
  const selector = sanitizeSelector(finding.target[finding.target.length - 1] ?? finding.target.join(" "));
  const parsed = selector ? parseSimpleSelector(selector) : {};
  const attributes: Record<string, string | boolean | number> = {};
  for (const [name, value] of Object.entries(parsed.classNames ? { class: parsed.classNames.join(" ") } : {})) {
    if (ALLOWED_ATTRIBUTE_NAMES.has(name) && !SENSITIVE_PATTERN.test(String(value))) {
      attributes[name] = String(value).slice(0, MAX_ATTRIBUTE_VALUE_LENGTH);
    }
  }
  if (parsed.elementId && ALLOWED_ATTRIBUTE_NAMES.has("id")) {
    attributes.id = parsed.elementId;
  }

  return {
    ruleId: finding.ruleId,
    impact: finding.sourceImpact ?? undefined,
    message: finding.message ?? finding.description,
    help: finding.title,
    helpUrl: finding.helpUrl,
    tags: finding.standards,
    element: {
      ...(parsed.tagName ? { tagName: parsed.tagName } : {}),
      ...(parsed.elementId ? { attributes: { id: parsed.elementId } } : {}),
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
    },
    context: {
      framework: project ? normalizeFramework(project.framework) : "unknown",
      route: finding.route,
      flow: finding.flowId,
      checkpoint: finding.checkpointId,
      profile: finding.profile,
      viewport: finding.viewport,
    },
    sourceMapping,
    sourceRanking,
  };
}
