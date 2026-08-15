import type {
  SourceMappingCandidate,
  SourceMappingDiagnostic,
  SourceMappingResult,
  SourceMappingSignal,
  VueSourceCatalog,
  VueSourceElement,
  VueSourceMappingEvidence,
} from "@a11yst/types";
import {
  createMappingFromExistingSourceLocation,
  createSourceMappingCandidate,
  createSourceMappingResult,
} from "@a11yst/source-mapping";
import {
  matchComponentByName,
  matchNativeElementsById,
  matchNativeElementsBySelector,
  parseVueSelector,
  vueAttributesMatch,
  vueTextMatches,
} from "./selectors.js";
import {
  componentNameAliases,
  sanitizeEvidenceText,
  sanitizeSelector,
  sortStringArray,
} from "./sanitize.js";

const STABLE_ATTRIBUTE_NAMES = new Set([
  "role",
  "aria-label",
  "alt",
  "title",
  "name",
  "type",
  "data-testid",
  "data-test",
  "data-cy",
  "disabled",
  "tabindex",
]);

function flattenCatalogElements(
  catalog: VueSourceCatalog,
  scopeIds: string[] | undefined,
): { elements: VueSourceElement[]; diagnostics: SourceMappingDiagnostic[]; unknownScope: boolean } {
  const diagnostics: SourceMappingDiagnostic[] = [];
  let unknownScope = false;

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
        unknownScope = true;
        diagnostics.push({
          code: "missing-source-location",
          level: "info",
          message: `Unknown Vue scope: ${scopeId}`,
        });
      }
    }
  }

  const elements = catalog.files
    .flatMap((file) => file.elements)
    .filter((element) => {
      if (scopeIds === undefined || scopeIds.length === 0) {
        return true;
      }
      return scopeIds.some((scopeId) => element.scopeIds.includes(scopeId));
    });

  return { elements, diagnostics, unknownScope };
}

function candidateFromElement(
  element: VueSourceElement,
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
    framework: "vue",
    adapter: "vue-sfc-static",
    language: "vue",
    component: element.ownerComponentHint,
    symbol:
      element.elementKind === "component" ? element.componentName : element.tagName,
  });
}

function filterByOwner(
  elements: VueSourceElement[],
  ownerComponent: string | undefined,
): VueSourceElement[] {
  if (ownerComponent === undefined) {
    return elements;
  }
  const aliases = new Set(componentNameAliases(ownerComponent));
  return elements.filter(
    (element) =>
      element.ownerComponentHint !== undefined && aliases.has(element.ownerComponentHint),
  );
}

function idConfidence(element: VueSourceElement): SourceMappingCandidate["confidence"] {
  if (element.hasSpreadBinding && element.spreadMayOverrideStaticAttributes) {
    return "medium";
  }
  return "high";
}

function sanitizeAttributes(
  attributes: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (attributes === undefined) {
    return undefined;
  }
  const sanitized: Record<string, string> = {};
  for (const [name, value] of Object.entries(attributes)) {
    const lower = name.toLowerCase();
    if (!STABLE_ATTRIBUTE_NAMES.has(lower) && lower !== "id" && lower !== "class") {
      continue;
    }
    const text = sanitizeEvidenceText(value, 256);
    if (text !== undefined) {
      sanitized[lower] = text;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function mapVueSource(input: {
  evidence: VueSourceMappingEvidence;
  catalog: VueSourceCatalog;
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
  const attributes = sanitizeAttributes(evidence.attributes);
  const componentName = evidence.componentName?.trim();
  const ownerComponent = evidence.ownerComponent?.trim();

  if (evidence.selector !== undefined && selector === undefined) {
    return createSourceMappingResult([], [
      {
        code: "invalid-source-uri",
        level: "error",
        message: "Vue selector evidence is invalid",
      },
    ]);
  }

  const flattened = flattenCatalogElements(input.catalog, evidence.scopeIds);
  diagnostics.push(...flattened.diagnostics);

  if (flattened.unknownScope && evidence.scopeIds !== undefined && evidence.scopeIds.length > 0) {
    return createSourceMappingResult([], [
      ...diagnostics,
      {
        code: "missing-source-location",
        level: "info",
        message: "Vue scope is unknown to the catalog",
      },
    ]);
  }

  const elements = filterByOwner(flattened.elements, ownerComponent);
  const nativeElements = elements.filter((element) => element.elementKind === "native");
  const componentElements = elements.filter((element) => element.elementKind === "component");

  const candidates: SourceMappingCandidate[] = [];
  const candidateKeys = new Set<string>();

  const pushCandidate = (candidate: SourceMappingCandidate): void => {
    const key = `${candidate.location.uri}\0${candidate.location.region.start.line}\0${candidate.location.region.start.column ?? ""}\0${candidate.confidence}\0${candidate.provenance}`;
    if (!candidateKeys.has(key)) {
      candidateKeys.add(key);
      candidates.push(candidate);
    }
  };

  const routeSignal = evidence.route
    ? [{ kind: "route" as const, matched: true, value: evidence.route.slice(0, 128) }]
    : [];

  if (selector !== undefined) {
    const parsed = parseVueSelector(selector);
    if (!parsed.ok) {
      return createSourceMappingResult([], [
        {
          code: "unsupported-provenance",
          level: "error",
          message: parsed.code,
        },
      ]);
    }

    const { matches } = matchNativeElementsBySelector(nativeElements, selector);
    if (matches.length === 1) {
      pushCandidate(
        candidateFromElement(matches[0]!, "high", "selector-match", [
          { kind: "selector", matched: true, value: selector.slice(0, 128) },
          ...routeSignal,
        ]),
      );
    } else if (matches.length > 1) {
      for (const match of matches) {
        pushCandidate(
          candidateFromElement(match, "high", "selector-match", [
            { kind: "selector", matched: true, value: selector.slice(0, 128) },
            ...routeSignal,
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Multiple Vue selector matches" },
      ]);
    }
  }

  if (elementId) {
    const idMatches = matchNativeElementsById(nativeElements, elementId, tagName);
    if (idMatches.length === 1 && candidates.length === 0) {
      pushCandidate(
        candidateFromElement(idMatches[0]!, idConfidence(idMatches[0]!), "static-source-index", [
          { kind: "attribute", matched: true, value: "id" },
          ...routeSignal,
        ]),
      );
    } else if (idMatches.length > 1) {
      for (const match of idMatches) {
        pushCandidate(
          candidateFromElement(match, idConfidence(match), "static-source-index", [
            { kind: "attribute", matched: true, value: "id" },
            ...routeSignal,
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Duplicate Vue id matches" },
      ]);
    }
  }

  if (attributes && Object.keys(attributes).length > 0) {
    const attributeMatches = nativeElements.filter((element) => {
      if (tagName !== undefined && element.tagName !== tagName) {
        return false;
      }
      return vueAttributesMatch(element, attributes) > 0;
    });

    const strongMatches = attributeMatches.filter((element) => {
      const matchCount = vueAttributesMatch(element, attributes);
      if (matchCount >= 2) {
        return true;
      }
      const stableOnly = Object.keys(attributes).some((name) => {
        const lower = name.toLowerCase();
        return (
          lower.startsWith("data-test") ||
          lower === "data-testid" ||
          lower === "data-cy" ||
          lower === "aria-label"
        );
      });
      return matchCount === 1 && stableOnly;
    });

    if (strongMatches.length === 1 && candidates.length === 0) {
      pushCandidate(
        candidateFromElement(strongMatches[0]!, "high", "static-source-index", [
          { kind: "attribute", matched: true, value: "attributes" },
          ...routeSignal,
        ]),
      );
    } else if (attributeMatches.length === 1 && candidates.length === 0) {
      pushCandidate(
        candidateFromElement(attributeMatches[0]!, "medium", "static-source-index", [
          { kind: "attribute", matched: true, value: "attributes" },
          ...routeSignal,
        ]),
      );
    } else if (strongMatches.length > 1 || attributeMatches.length > 1) {
      const ambiguousMatches = strongMatches.length > 1 ? strongMatches : attributeMatches;
      for (const match of ambiguousMatches) {
        pushCandidate(
          candidateFromElement(match, "medium", "static-source-index", [
            { kind: "attribute", matched: true, value: "attributes" },
            ...routeSignal,
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Multiple Vue attribute matches" },
      ]);
    }
  }

  if (visibleText || accessibleName) {
    const textToMatch = visibleText ?? accessibleName;
    if (textToMatch) {
      const textMatchesList = nativeElements.filter((element) => {
        if (tagName !== undefined && element.tagName !== tagName) {
          return false;
        }
        return vueTextMatches(element, textToMatch);
      });

      if (textMatchesList.length === 1 && candidates.length === 0) {
        pushCandidate(
          candidateFromElement(textMatchesList[0]!, tagName ? "medium" : "low", "text-match", [
            { kind: "visible-text", matched: true, value: textToMatch.slice(0, 128) },
            ...routeSignal,
          ]),
        );
      } else if (textMatchesList.length > 1) {
        for (const match of textMatchesList) {
          pushCandidate(
            candidateFromElement(match, tagName ? "medium" : "low", "text-match", [
              { kind: "visible-text", matched: true, value: textToMatch.slice(0, 128) },
              ...routeSignal,
            ]),
          );
        }
        return createSourceMappingResult(candidates, [
          ...diagnostics,
          { code: "ambiguous-candidates", level: "info", message: "Multiple Vue text matches" },
        ]);
      }
    }
  }

  if (componentName) {
    const componentMatches = matchComponentByName(componentElements, componentName);
    if (componentMatches.length === 1 && candidates.length === 0) {
      pushCandidate(
        candidateFromElement(componentMatches[0]!, "medium", "component-match", [
          { kind: "component-name", matched: true, value: componentName.slice(0, 128) },
          ...routeSignal,
        ]),
      );
    } else if (componentMatches.length > 1) {
      for (const match of componentMatches) {
        pushCandidate(
          candidateFromElement(match, "medium", "component-match", [
            { kind: "component-name", matched: true, value: componentName.slice(0, 128) },
            ...routeSignal,
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Multiple Vue component matches" },
      ]);
    }
  }

  if (candidates.length === 0) {
    return createSourceMappingResult([], [
      ...diagnostics,
      { code: "missing-source-location", level: "info", message: "Vue source was not matched" },
    ]);
  }

  if (candidates.length === 1) {
    return createSourceMappingResult(candidates, diagnostics);
  }

  return createSourceMappingResult(candidates, [
    ...diagnostics,
    { code: "ambiguous-candidates", level: "info", message: "Multiple Vue source matches" },
  ]);
}
