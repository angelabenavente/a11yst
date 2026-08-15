import type { AccessibilityProfile, Finding } from "@a11yst/types";
import {
  DEFAULT_UNKNOWN_AXE_SEVERITY,
  formatSeverityLabel,
  isKnownAxeImpact,
  mapAxeImpactToSeverity,
  normalizeAxeImpact,
  severityRank,
} from "@a11yst/types";

export {
  DEFAULT_UNKNOWN_AXE_SEVERITY,
  formatSeverityLabel,
  isKnownAxeImpact,
  mapAxeImpactToSeverity,
  normalizeAxeImpact,
} from "@a11yst/types";

/**
 * Minimal shape of an axe-core node result that we rely on.
 * Deliberately decoupled from `@axe-core/playwright`'s types so this module
 * has no runtime dependency on Playwright and stays unit-testable in
 * isolation (e.g. with hand-written fixtures).
 */
export interface AxeNodeResultLike {
  html?: string;
  /**
   * axe-core's `target` is a CSS selector path. Entries are usually plain
   * strings; nested arrays represent an iframe/shadow-DOM hop and are
   * flattened into a single readable segment.
   */
  target?: ReadonlyArray<string | readonly string[]>;
  failureSummary?: string;
}

/**
 * Minimal shape of an axe-core violation result that we rely on.
 */
export interface AxeViolationLike {
  id: string;
  impact?: string | null;
  help?: string;
  description?: string;
  helpUrl?: string;
  tags?: readonly string[];
  nodes?: readonly AxeNodeResultLike[];
}

/**
 * Context describing where a set of axe violations came from, used to
 * populate the project/route/profile/viewport fields on each `Finding`.
 */
export interface AxeNormalizationContext {
  projectName: string;
  profile: AccessibilityProfile;
  /** Stable route identifier, when supplied by planning. */
  routeId?: string;
  /** Human-readable route name, when supplied by planning. */
  routeName?: string;
  /** Route path (e.g. `/pricing`), if this run targeted a specific route. */
  route?: string;
  /** Fully-resolved URL that was navigated to. */
  url?: string;
  /** Viewport name (e.g. `desktop`), if this run used a named viewport. */
  viewport?: string;
}

const HTML_TRUNCATE_LENGTH = 500;

/**
 * Flatten axe-core's `target` (which may contain nested arrays for
 * iframe/shadow-DOM hops) into a flat list of readable selector segments.
 */
function normalizeTarget(
  target: ReadonlyArray<string | readonly string[]> | undefined,
): string[] {
  if (!target || target.length === 0) {
    return [];
  }
  return target.map((entry) =>
    Array.isArray(entry) ? entry.join(" >>> ") : String(entry),
  );
}

/**
 * Remove current form-control values before retaining axe's short node HTML.
 * This intentionally works on a fragment rather than parsing/serialising a
 * document, so malformed axe snippets are handled conservatively too.
 */
export function sanitizeHtmlSnippet(html: string | undefined): string | undefined {
  if (!html) {
    return undefined;
  }

  const removeSensitiveAttributes = (tag: string): string =>
    tag
      .replace(/\svalue\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\sselected(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, "");

  let sanitized = html.replace(/<input\b[^>]*>/gi, removeSensitiveAttributes);
  sanitized = sanitized.replace(
    /<textarea\b[^>]*>[\s\S]*?(?:<\/textarea\s*>|$)/gi,
    (fragment) => {
      const openingTag = fragment.match(/^<textarea\b[^>]*>/i)?.[0];
      return openingTag
        ? `${removeSensitiveAttributes(openingTag)}[REDACTED]</textarea>`
        : "<textarea>[REDACTED]</textarea>";
    },
  );
  sanitized = sanitized.replace(
    /<select\b[^>]*>[\s\S]*?(?:<\/select\s*>|$)/gi,
    (fragment) => {
      const openingTag = fragment.match(/^<select\b[^>]*>/i)?.[0];
      return openingTag
        ? `${removeSensitiveAttributes(openingTag)}[REDACTED]</select>`
        : "<select>[REDACTED]</select>";
    },
  );
  sanitized = sanitized.replace(
    /<form\b([^>]*)>[\s\S]*?<\/form\s*>/gi,
    (_fragment, attributes: string) => `<form${attributes}>[REDACTED]</form>`,
  );

  if (sanitized.length <= HTML_TRUNCATE_LENGTH) {
    return sanitized;
  }
  return `${sanitized.slice(0, HTML_TRUNCATE_LENGTH)}…`;
}

/**
 * Standards tags worth surfacing on a `Finding`: WCAG success criteria
 * (`wcag2a`, `wcag21aa`, ...), Deque's `best-practice` tag, and axe-core's
 * `cat.*` rule categories. Other internal axe tags (e.g. `cat.aria` overlaps
 * with `cat.*` so it's included; things like `experimental` are dropped).
 */
function filterStandardsTags(tags: readonly string[]): string[] {
  return tags.filter(
    (tag) =>
      /^wcag/i.test(tag) || tag === "best-practice" || /^cat\./i.test(tag),
  );
}

function slugifySegment(segment: string): string {
  return segment
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parts used to derive both a finding's id and its fingerprint.
 */
export interface FindingKeyParts {
  ruleId: string;
  projectName: string;
  route?: string;
  profile: string;
  viewport?: string;
  /** Primary (first) target selector segment for this finding's element. */
  target?: string;
}

/**
 * Build a deterministic, URL/filesystem-safe id for a finding.
 *
 * Same inputs always produce the same id. Two distinct elements matching
 * the same rule on the same page produce different ids because `target`
 * (the offending element's selector) is part of the key.
 */
export function createFindingId(parts: FindingKeyParts): string {
  const segments = [
    parts.ruleId,
    parts.projectName,
    parts.route ?? "no-route",
    parts.profile,
    parts.viewport ?? "no-viewport",
    parts.target ?? "no-target",
  ];
  return segments.map(slugifySegment).filter(Boolean).join("::");
}

/**
 * Build a fingerprint for deduplication/baseline matching.
 *
 * Severity is intentionally excluded so canonical severity mapping changes
 * do not alter baseline identity for the same DOM finding.
 */
export function createFindingFingerprint(
  parts: Omit<FindingKeyParts, "target"> & { target: readonly string[] },
): string {
  const normalizedTarget = parts.target.join(",");
  return [
    parts.ruleId,
    parts.projectName,
    parts.route ?? "",
    parts.profile,
    parts.viewport ?? "",
    normalizedTarget,
  ].join("|");
}

/**
 * Normalise a list of axe-core violations (from one page/run) into a11yst
 * `Finding`s. One `Finding` is produced per offending DOM node, since each
 * node has its own `html`/`target`/`failureSummary`.
 */
export function normalizeAxeViolations(
  violations: readonly AxeViolationLike[],
  context: AxeNormalizationContext,
): Finding[] {
  const findings: Finding[] = [];

  for (const violation of violations) {
    const severity = mapAxeImpactToSeverity(violation.impact);
    const sourceImpact = normalizeAxeImpact(violation.impact);
    const impactWasKnown = isKnownAxeImpact(violation.impact);
    const standards = filterStandardsTags(violation.tags ?? []);
    const title = violation.help?.trim() || violation.description?.trim() || violation.id;
    let description = violation.description?.trim();
    if (!impactWasKnown) {
      const note = `axe-core did not report an impact for this rule; severity defaulted to "${formatSeverityLabel(DEFAULT_UNKNOWN_AXE_SEVERITY)}".`;
      description = description ? `${description} (${note})` : note;
    }

    for (const node of violation.nodes ?? []) {
      const target = normalizeTarget(node.target);
      const htmlSnippet = sanitizeHtmlSnippet(node.html);
      const keyParts: FindingKeyParts = {
        ruleId: violation.id,
        projectName: context.projectName,
        route: context.route,
        profile: context.profile,
        viewport: context.viewport,
        target: target[0],
      };

      findings.push({
        id: createFindingId(keyParts),
        fingerprint: createFindingFingerprint({ ...keyParts, target }),
        fingerprintVersion: "1",
        source: "axe",
        ruleId: violation.id,
        title,
        description,
        severity,
        sourceImpact,
        routeId: context.routeId,
        routeName: context.routeName,
        route: context.route,
        url: context.url,
        projectName: context.projectName,
        profile: context.profile,
        viewport: context.viewport,
        target,
        html: htmlSnippet,
        failureSummary: node.failureSummary?.trim(),
        helpUrl: violation.helpUrl,
        standards,
        confidence: "high",
        automation: "automated",
        evidence: { htmlSnippet },
      });
    }
  }

  return findings;
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Sort findings deterministically for stable output/reporting:
 * project, route, profile, viewport, severity (critical first), ruleId,
 * then the joined target selector as a final tiebreaker.
 */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      compareStrings(a.projectName, b.projectName) ||
      compareStrings(a.route ?? "", b.route ?? "") ||
      compareStrings(a.profile, b.profile) ||
      compareStrings(a.viewport ?? "", b.viewport ?? "") ||
      severityRank(b.severity) - severityRank(a.severity) ||
      compareStrings(a.ruleId, b.ruleId) ||
      compareStrings(a.target.join(","), b.target.join(",")),
  );
}
