import type {
  HtmlSourceCatalog,
  HtmlSourceElement,
  HtmlSourceMappingEvidence,
  SourceMappingCandidate,
  SourceMappingDiagnostic,
  SourceMappingResult,
  SourceMappingSignal,
} from "@a11yst/types";
import {
  createMappingFromExistingSourceLocation,
  createSourceMappingCandidate,
  createSourceMappingResult,
} from "@a11yst/source-mapping";
import { filterElementsByRoute, normalizeRoute } from "./routes.js";
import {
  attributesMatch,
  matchElementsById,
  matchElementsBySelector,
  parseHtmlSelector,
  textMatches,
} from "./selectors.js";
import {
  normalizeText,
  sanitizeEvidenceAttributes,
  sanitizeEvidenceText,
  sanitizeSelector,
  sortStringArray,
} from "./sanitize.js";

function flattenCatalogElements(
  catalog: HtmlSourceCatalog,
  scopeIds: string[] | undefined,
): { elements: HtmlSourceElement[]; diagnostics: SourceMappingDiagnostic[] } {
  const diagnostics: SourceMappingDiagnostic[] = [];
  if (scopeIds !== undefined && scopeIds.length > 0) {
    const requested = sortStringArray(scopeIds);
    const known = new Set<string>();
    for (const file of catalog.files) {
      for (const scopeId of file.scopeIds) {
        known.add(scopeId);
      }
    }
    for (const scopeId of requested) {
      if (!known.has(scopeId)) {
        diagnostics.push({
          code: "missing-source-location",
          level: "info",
          message: `Unknown HTML scope: ${scopeId}`,
        });
      }
    }
  }

  const elements = catalog.files.flatMap((file) => file.elements).filter((element) => {
    if (scopeIds === undefined || scopeIds.length === 0) {
      return true;
    }
    return scopeIds.some((scopeId) => element.scopeIds.includes(scopeId));
  });

  return { elements, diagnostics };
}

function candidateFromElement(
  element: HtmlSourceElement,
  confidence: SourceMappingCandidate["confidence"],
  provenance: SourceMappingCandidate["provenance"],
  signals: SourceMappingSignal[],
): SourceMappingCandidate {
  return createSourceMappingCandidate({
    uri: element.uri,
    region: element.region,
    confidence,
    provenance,
    signals,
    adapter: "html-static",
    language: "html",
  });
}

function buildSignals(signals: SourceMappingSignal[]): SourceMappingSignal[] {
  return signals;
}

export function mapHtmlSource(input: {
  evidence: HtmlSourceMappingEvidence;
  catalog: HtmlSourceCatalog;
}): SourceMappingResult {
  const evidence = input.evidence;

  if (evidence.existingSourceLocation !== undefined) {
    return createMappingFromExistingSourceLocation(evidence.existingSourceLocation);
  }

  const diagnostics: SourceMappingDiagnostic[] = [];
  const selector = sanitizeSelector(evidence.selector);
  const elementId = evidence.elementId?.trim();
  const tagName = evidence.tagName?.toLowerCase();
  const accessibleName = sanitizeEvidenceText(evidence.accessibleName, 256);
  const visibleText = sanitizeEvidenceText(evidence.visibleText, 256);
  const attributes = sanitizeEvidenceAttributes(evidence.attributes);
  const classNames =
    evidence.classNames !== undefined ? sortStringArray(evidence.classNames) : undefined;
  const route = normalizeRoute(evidence.route);

  if (evidence.selector !== undefined && selector === undefined) {
    return createSourceMappingResult([], [
      {
        code: "invalid-source-uri",
        level: "error",
        message: "HTML selector evidence is invalid",
      },
    ]);
  }

  let { elements } = flattenCatalogElements(input.catalog, evidence.scopeIds);
  const routeFilter = filterElementsByRoute(elements, route);
  elements = routeFilter.elements;
  if (route !== undefined && !routeFilter.matched) {
    diagnostics.push({
      code: "missing-source-location",
      level: "info",
      message: "Route did not match any HTML file",
    });
  }

  const candidates: SourceMappingCandidate[] = [];
  const candidateKeys = new Set<string>();

  const pushCandidate = (candidate: SourceMappingCandidate): void => {
    const key = `${candidate.location.uri}\0${candidate.location.region.start.line}\0${candidate.location.region.start.column ?? ""}\0${candidate.confidence}\0${candidate.provenance}`;
    if (!candidateKeys.has(key)) {
      candidateKeys.add(key);
      candidates.push(candidate);
    }
  };

  if (selector !== undefined) {
    const parsed = parseHtmlSelector(selector);
    if (!parsed.ok) {
      return createSourceMappingResult([], [
        {
          code: "unsupported-provenance",
          level: "error",
          message: parsed.code,
        },
      ]);
    }

    const matches = matchElementsBySelector(elements, selector);
    if (matches.length === 1) {
      pushCandidate(
        candidateFromElement(matches[0]!, "high", "selector-match", [
          { kind: "selector", matched: true, value: selector.slice(0, 128) },
        ]),
      );
    } else if (matches.length > 1) {
      for (const match of matches) {
        pushCandidate(
          candidateFromElement(match, "high", "selector-match", [
            { kind: "selector", matched: true, value: selector.slice(0, 128) },
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        {
          code: "ambiguous-candidates",
          level: "info",
          message: "Multiple HTML selector matches",
        },
      ]);
    }
  }

  if (elementId) {
    const idMatches = matchElementsById(elements, elementId, tagName);
    if (idMatches.length === 1 && candidates.length === 0) {
      pushCandidate(
        candidateFromElement(idMatches[0]!, "high", "static-source-index", [
          { kind: "attribute", matched: true, value: "id" },
        ]),
      );
    } else if (idMatches.length > 1) {
      for (const match of idMatches) {
        pushCandidate(
          candidateFromElement(match, "high", "static-source-index", [
            { kind: "attribute", matched: true, value: "id" },
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Duplicate HTML id matches" },
      ]);
    }
  }

  if (attributes && Object.keys(attributes).length > 0) {
    const attributeMatches = elements.filter((element) => {
      if (tagName !== undefined && element.tagName !== tagName) {
        return false;
      }
      if (classNames !== undefined && !classNames.every((name) => element.classNames.includes(name))) {
        return false;
      }
      return attributesMatch(element, attributes) >= Object.keys(attributes).length;
    });

    if (attributeMatches.length === 1 && candidates.length === 0) {
      const matchCount = Object.keys(attributes).length;
      pushCandidate(
        candidateFromElement(
          attributeMatches[0]!,
          matchCount >= 2 ? "high" : "medium",
          "static-source-index",
          buildSignals(
            Object.keys(attributes).map((name) => ({
              kind: "attribute",
              matched: true,
              value: name,
            })),
          ),
        ),
      );
    } else if (attributeMatches.length > 1 && candidates.length === 0) {
      for (const match of attributeMatches) {
        pushCandidate(
          candidateFromElement(match, "medium", "static-source-index", [
            { kind: "attribute", matched: true },
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Multiple HTML attribute matches" },
      ]);
    }
  }

  if (visibleText && tagName) {
    const normalized = normalizeText(visibleText);
    const textMatchElements = elements.filter(
      (element) => element.tagName === tagName && textMatches(element, normalized),
    );
    if (textMatchElements.length === 1 && candidates.length === 0) {
      pushCandidate(
        candidateFromElement(textMatchElements[0]!, "medium", "text-match", [
          { kind: "visible-text", matched: true },
        ]),
      );
    } else if (textMatchElements.length > 1 && candidates.length === 0) {
      for (const match of textMatchElements) {
        pushCandidate(
          candidateFromElement(match, "medium", "text-match", [
            { kind: "visible-text", matched: true },
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Multiple HTML text matches" },
      ]);
    }
  }

  if (accessibleName && candidates.length === 0) {
    const nameMatches = elements.filter((element) => element.staticAccessibleName === accessibleName);
    if (nameMatches.length === 1) {
      pushCandidate(
        candidateFromElement(nameMatches[0]!, "medium", "text-match", [
          { kind: "accessible-name", matched: true },
        ]),
      );
    } else if (nameMatches.length > 1) {
      for (const match of nameMatches) {
        pushCandidate(
          candidateFromElement(match, "medium", "text-match", [
            { kind: "accessible-name", matched: true },
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Multiple accessible name matches" },
      ]);
    }
  }

  if (candidates.length === 0) {
    return createSourceMappingResult([], [
      ...diagnostics,
      {
        code: "missing-source-location",
        level: "info",
        message: "No HTML source element matched the evidence",
      },
    ]);
  }

  return createSourceMappingResult(candidates, diagnostics);
}
