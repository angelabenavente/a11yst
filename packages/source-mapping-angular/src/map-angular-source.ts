import type {
  AngularSourceCatalog,
  AngularSourceElement,
  AngularSourceMappingEvidence,
  AngularTemplateKind,
  SourceMappingAngularMetadata,
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
import {
  angularAttributesMatch,
  angularTextMatches,
  matchComponentElements,
  matchNativeElementsById,
  matchNativeElementsBySelector,
  parseAngularSelector,
} from "./selectors.js";
import { sanitizeEvidenceText, sanitizeSelector, sortStringArray } from "./sanitize.js";

const STABLE_ATTRIBUTE_NAMES = new Set([
  "role", "aria-label", "alt", "title", "name", "type",
  "data-testid", "data-test", "data-cy", "disabled", "tabindex",
]);

function flattenElements(
  catalog: AngularSourceCatalog,
  scopeIds: string[] | undefined,
  templateKind: AngularTemplateKind | undefined,
): { elements: AngularSourceElement[]; diagnostics: SourceMappingDiagnostic[]; unknownScope: boolean } {
  const diagnostics: SourceMappingDiagnostic[] = [];
  let unknownScope = false;

  if (scopeIds !== undefined && scopeIds.length > 0) {
    const requested = sortStringArray(scopeIds);
    const known = new Set<string>();
    for (const template of catalog.templates) {
      for (const scopeId of template.scopeIds) {
        known.add(scopeId);
      }
    }
    for (const scopeId of requested) {
      if (!known.has(scopeId)) {
        unknownScope = true;
        diagnostics.push({
          code: "missing-source-location",
          level: "info",
          message: `Unknown Angular scope: ${scopeId}`,
        });
      }
    }
  }

  const elements = catalog.templates
    .filter((template) => templateKind === undefined || template.templateKind === templateKind)
    .flatMap((template) => template.elements)
    .filter((element) => {
      if (scopeIds === undefined || scopeIds.length === 0) {
        return true;
      }
      return scopeIds.some((scopeId) => element.scopeIds.includes(scopeId));
    });

  return { elements, diagnostics, unknownScope };
}

function candidateLocationKey(candidate: SourceMappingCandidate): string {
  return `${candidate.location.uri}\0${candidate.location.region.start.line}\0${candidate.location.region.start.column ?? ""}`;
}

function enrichAngularResult(
  result: SourceMappingResult,
  metadataByLocation: Map<string, SourceMappingAngularMetadata>,
): SourceMappingResult {
  const candidates = result.candidates.map((candidate) => {
    const angular = metadataByLocation.get(candidateLocationKey(candidate));
    if (angular === undefined) {
      return candidate;
    }
    return {
      ...candidate,
      framework: "angular",
      adapter: "angular-template-static",
      angular,
    };
  });

  return {
    ...result,
    candidates,
    selected:
      result.selected === undefined
        ? undefined
        : candidates.find(
            (candidate) => candidateLocationKey(candidate) === candidateLocationKey(result.selected!),
          ),
  };
}

function candidateFromElement(
  element: AngularSourceElement,
  confidence: SourceMappingCandidate["confidence"],
  provenance: SourceMappingCandidate["provenance"],
  signals: SourceMappingSignal[],
  metadataByLocation: Map<string, SourceMappingAngularMetadata>,
): SourceMappingCandidate {
  const candidate = createSourceMappingCandidate({
    uri: element.uri,
    region: element.region,
    confidence,
    provenance,
    signals,
    framework: "angular",
    adapter: "angular-template-static",
    language: element.templateKind === "inline" ? "typescript" : "html",
    component: element.ownerComponent,
    symbol: element.elementKind === "component" ? element.componentName ?? element.componentSelector : element.tagName,
  });

  metadataByLocation.set(candidateLocationKey(candidate), {
    templateKind: element.templateKind,
    componentSelector: element.componentSelector,
    hasConditionalRendering: element.hasConditionalRendering,
    hasRepeatedRendering: element.hasRepeatedRendering,
    hasDeferredRendering: element.hasDeferredRendering,
  });

  return candidate;
}

function sanitizeAttributes(attributes: Record<string, string> | undefined): Record<string, string> | undefined {
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

export function mapAngularSource(input: {
  evidence: AngularSourceMappingEvidence;
  catalog: AngularSourceCatalog;
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
  const componentSelector = evidence.componentSelector?.trim();
  const ownerComponent = evidence.ownerComponent?.trim();

  if (evidence.selector !== undefined && selector === undefined) {
    return createSourceMappingResult([], [{
      code: "invalid-source-uri",
      level: "error",
      message: "Angular selector evidence is invalid",
    }]);
  }

  const flattened = flattenElements(input.catalog, evidence.scopeIds, evidence.templateKind);
  diagnostics.push(...flattened.diagnostics);

  if (flattened.unknownScope && evidence.scopeIds !== undefined && evidence.scopeIds.length > 0) {
    return createSourceMappingResult([], [
      ...diagnostics,
      { code: "missing-source-location", level: "info", message: "Angular scope is unknown to the catalog" },
    ]);
  }

  let elements = flattened.elements;
  if (ownerComponent) {
    elements = elements.filter((element) => element.ownerComponent === ownerComponent);
  }

  const nativeElements = elements.filter((element) => element.elementKind === "native");
  const componentElements = elements.filter((element) => element.elementKind === "component");

  const candidates: SourceMappingCandidate[] = [];
  const candidateKeys = new Set<string>();
  const angularMetadataByLocation = new Map<string, SourceMappingAngularMetadata>();
  const routeSignal = evidence.route
    ? [{ kind: "route" as const, matched: true, value: evidence.route.slice(0, 128) }]
    : [];

  const finalize = (result: SourceMappingResult): SourceMappingResult =>
    enrichAngularResult(result, angularMetadataByLocation);

  const pushCandidate = (candidate: SourceMappingCandidate): void => {
    const key = `${candidate.location.uri}\0${candidate.location.region.start.line}\0${candidate.location.region.start.column ?? ""}\0${candidate.confidence}\0${candidate.provenance}`;
    if (!candidateKeys.has(key)) {
      candidateKeys.add(key);
      candidates.push(candidate);
    }
  };

  if (selector !== undefined) {
    const parsed = parseAngularSelector(selector);
    if (!parsed.ok) {
      return createSourceMappingResult([], [{
        code: "unsupported-provenance",
        level: "error",
        message: parsed.code,
      }]);
    }
    const matches = matchNativeElementsBySelector(nativeElements, selector);
    if (matches.length === 1) {
      pushCandidate(candidateFromElement(matches[0]!, "high", "selector-match", [
        { kind: "selector", matched: true, value: selector.slice(0, 128) },
        ...routeSignal,
      ], angularMetadataByLocation));
    } else if (matches.length > 1) {
      for (const match of matches) {
        pushCandidate(candidateFromElement(match, "high", "selector-match", [
          { kind: "selector", matched: true, value: selector.slice(0, 128) },
          ...routeSignal,
        ], angularMetadataByLocation));
      }
      return finalize(createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Multiple Angular selector matches" },
      ]));
    }
  }

  if (elementId) {
    const idMatches = matchNativeElementsById(nativeElements, elementId, tagName);
    const confidence = (element: AngularSourceElement): SourceMappingCandidate["confidence"] =>
      element.hasAttributeSpread ? "medium" : "high";
    if (idMatches.length === 1 && candidates.length === 0) {
      pushCandidate(candidateFromElement(idMatches[0]!, confidence(idMatches[0]!), "static-source-index", [
        { kind: "attribute", matched: true, value: "id" },
        ...routeSignal,
      ], angularMetadataByLocation));
    } else if (idMatches.length > 1) {
      for (const match of idMatches) {
        pushCandidate(candidateFromElement(match, confidence(match), "static-source-index", [
          { kind: "attribute", matched: true, value: "id" },
          ...routeSignal,
        ], angularMetadataByLocation));
      }
      return finalize(createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Duplicate Angular id matches" },
      ]));
    }
  }

  if (attributes && Object.keys(attributes).length > 0) {
    const attributeMatches = nativeElements.filter((element) => {
      if (tagName !== undefined && element.tagName !== tagName) {
        return false;
      }
      return angularAttributesMatch(element, attributes) > 0;
    });
    const strongMatches = attributeMatches.filter((element) => {
      const count = angularAttributesMatch(element, attributes);
      if (count >= 2) {
        return true;
      }
      return count === 1 && Object.keys(attributes).some((name) => {
        const lower = name.toLowerCase();
        return lower.startsWith("data-test") || lower === "aria-label";
      });
    });
    if (strongMatches.length === 1 && candidates.length === 0) {
      pushCandidate(candidateFromElement(strongMatches[0]!, "high", "static-source-index", [
        { kind: "attribute", matched: true, value: "attributes" },
        ...routeSignal,
      ], angularMetadataByLocation));
    } else if (attributeMatches.length === 1 && candidates.length === 0) {
      pushCandidate(candidateFromElement(attributeMatches[0]!, "medium", "static-source-index", [
        { kind: "attribute", matched: true, value: "attributes" },
        ...routeSignal,
      ], angularMetadataByLocation));
    } else if (strongMatches.length > 1 || attributeMatches.length > 1) {
      const ambiguousMatches = strongMatches.length > 1 ? strongMatches : attributeMatches;
      for (const match of ambiguousMatches) {
        pushCandidate(candidateFromElement(match, "medium", "static-source-index", [
          { kind: "attribute", matched: true, value: "attributes" },
          ...routeSignal,
        ], angularMetadataByLocation));
      }
      return finalize(createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Multiple Angular attribute matches" },
      ]));
    }
  }

  if (visibleText || accessibleName) {
    const textToMatch = visibleText ?? accessibleName;
    if (textToMatch) {
      const textMatchesList = nativeElements.filter((element) => {
        if (tagName !== undefined && element.tagName !== tagName) {
          return false;
        }
        return angularTextMatches(element, textToMatch);
      });
      if (textMatchesList.length === 1 && candidates.length === 0) {
        pushCandidate(candidateFromElement(textMatchesList[0]!, tagName ? "medium" : "low", "text-match", [
          { kind: "visible-text", matched: true, value: textToMatch.slice(0, 128) },
          ...routeSignal,
        ], angularMetadataByLocation));
      } else if (textMatchesList.length > 1) {
        for (const match of textMatchesList) {
          pushCandidate(candidateFromElement(match, tagName ? "medium" : "low", "text-match", [
            { kind: "visible-text", matched: true, value: textToMatch.slice(0, 128) },
            ...routeSignal,
          ], angularMetadataByLocation));
        }
        return finalize(createSourceMappingResult(candidates, [
          ...diagnostics,
          { code: "ambiguous-candidates", level: "info", message: "Multiple Angular text matches" },
        ]));
      }
    }
  }

  if (componentName || componentSelector) {
    const componentMatches = matchComponentElements(componentElements, componentName, componentSelector);
    if (componentMatches.length === 1 && candidates.length === 0) {
      pushCandidate(candidateFromElement(componentMatches[0]!, "medium", "component-match", [
        { kind: "component-name", matched: true, value: (componentName ?? componentSelector ?? "").slice(0, 128) },
        ...routeSignal,
      ], angularMetadataByLocation));
    } else if (componentMatches.length > 1) {
      for (const match of componentMatches) {
        pushCandidate(candidateFromElement(match, "medium", "component-match", [
          { kind: "component-name", matched: true, value: (componentName ?? componentSelector ?? "").slice(0, 128) },
          ...routeSignal,
        ], angularMetadataByLocation));
      }
      return finalize(createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Multiple Angular component matches" },
      ]));
    }
  }

  if (candidates.length === 0) {
    return createSourceMappingResult([], [
      ...diagnostics,
      { code: "missing-source-location", level: "info", message: "Angular source was not matched" },
    ]);
  }

  if (candidates.length === 1) {
    return finalize(createSourceMappingResult(candidates, diagnostics));
  }

  return finalize(createSourceMappingResult(candidates, [
    ...diagnostics,
    { code: "ambiguous-candidates", level: "info", message: "Multiple Angular source matches" },
  ]));
}
