import type {
  ReactSourceCatalog,
  ReactSourceElement,
  ReactSourceMappingEvidence,
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
  matchIntrinsicElementsById,
  matchIntrinsicElementsBySelector,
  parseReactSelector,
  reactAttributesMatch,
  reactTextMatches,
} from "./selectors.js";
import {
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
  catalog: ReactSourceCatalog,
  scopeIds: string[] | undefined,
): { elements: ReactSourceElement[]; diagnostics: SourceMappingDiagnostic[]; unknownScope: boolean } {
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
          message: `Unknown React scope: ${scopeId}`,
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

function languageForUri(uri: string): "jsx" | "tsx" {
  return uri.endsWith(".tsx") ? "tsx" : "jsx";
}

function candidateFromElement(
  element: ReactSourceElement,
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
    framework: "react",
    adapter: "react-static",
    language: languageForUri(element.uri),
    component: element.ownerComponent,
    symbol:
      element.elementKind === "component"
        ? element.componentName
        : element.tagName,
  });
}

function filterByOwner(
  elements: ReactSourceElement[],
  ownerComponent: string | undefined,
): ReactSourceElement[] {
  if (ownerComponent === undefined) {
    return elements;
  }
  return elements.filter((element) => element.ownerComponent === ownerComponent);
}

function idConfidence(element: ReactSourceElement): SourceMappingCandidate["confidence"] {
  if (element.hasSpreadProps && element.spreadBeforeStaticProps) {
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
    if (!STABLE_ATTRIBUTE_NAMES.has(lower) && lower !== "id" && lower !== "class" && lower !== "classname") {
      continue;
    }
    const text = sanitizeEvidenceText(value, 256);
    if (text !== undefined) {
      sanitized[lower] = text;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function mapReactSource(input: {
  evidence: ReactSourceMappingEvidence;
  catalog: ReactSourceCatalog;
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
  const classNames =
    evidence.classNames !== undefined ? sortStringArray(evidence.classNames) : undefined;
  const componentName = evidence.componentName?.trim();
  const ownerComponent = evidence.ownerComponent?.trim();

  if (evidence.selector !== undefined && selector === undefined) {
    return createSourceMappingResult([], [
      {
        code: "invalid-source-uri",
        level: "error",
        message: "React selector evidence is invalid",
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
        message: "React scope is unknown to the catalog",
      },
    ]);
  }

  const elements = filterByOwner(flattened.elements, ownerComponent);

  const candidates: SourceMappingCandidate[] = [];
  const candidateKeys = new Set<string>();

  const pushCandidate = (candidate: SourceMappingCandidate): void => {
    const key = `${candidate.location.uri}\0${candidate.location.region.start.line}\0${candidate.location.region.start.column ?? ""}\0${candidate.confidence}\0${candidate.provenance}`;
    if (!candidateKeys.has(key)) {
      candidateKeys.add(key);
      candidates.push(candidate);
    }
  };

  const intrinsicElements = elements.filter((element) => element.elementKind === "intrinsic");
  const componentElements = elements.filter((element) => element.elementKind === "component");

  if (selector !== undefined) {
    const parsed = parseReactSelector(selector);
    if (!parsed.ok) {
      return createSourceMappingResult([], [
        {
          code: "unsupported-provenance",
          level: "error",
          message: parsed.code,
        },
      ]);
    }

    const { matches } = matchIntrinsicElementsBySelector(intrinsicElements, selector);
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
        { code: "ambiguous-candidates", level: "info", message: "Multiple React selector matches" },
      ]);
    }
  }

  if (elementId) {
    const idMatches = matchIntrinsicElementsById(intrinsicElements, elementId, tagName);
    if (idMatches.length === 1 && candidates.length === 0) {
      const match = idMatches[0]!;
      pushCandidate(
        candidateFromElement(match, idConfidence(match), "static-source-index", [
          { kind: "attribute", matched: true, value: "id" },
        ]),
      );
    } else if (idMatches.length > 1) {
      for (const match of idMatches) {
        pushCandidate(
          candidateFromElement(match, idConfidence(match), "static-source-index", [
            { kind: "attribute", matched: true, value: "id" },
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Duplicate React id matches" },
      ]);
    }
  }

  if (attributes && Object.keys(attributes).length > 0) {
    const attributeMatches = intrinsicElements.filter((element) => {
      if (tagName !== undefined && element.tagName !== tagName) {
        return false;
      }
      return reactAttributesMatch(element, attributes) > 0;
    });

    const strongMatches = attributeMatches.filter((element) => {
      const matchCount = reactAttributesMatch(element, attributes);
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
        ]),
      );
    } else if (strongMatches.length === 1 && candidates.length > 0) {
      pushCandidate(
        candidateFromElement(strongMatches[0]!, "medium", "static-source-index", [
          { kind: "attribute", matched: true, value: "attributes" },
        ]),
      );
    } else if (attributeMatches.length === 1 && candidates.length === 0) {
      pushCandidate(
        candidateFromElement(attributeMatches[0]!, "medium", "static-source-index", [
          { kind: "attribute", matched: true, value: "attributes" },
        ]),
      );
    } else if (strongMatches.length > 1 || attributeMatches.length > 1) {
      const ambiguousMatches = strongMatches.length > 1 ? strongMatches : attributeMatches;
      for (const match of ambiguousMatches) {
        pushCandidate(
          candidateFromElement(match, "medium", "static-source-index", [
            { kind: "attribute", matched: true, value: "attributes" },
          ]),
        );
      }
      if (candidates.length > 1) {
        return createSourceMappingResult(candidates, [
          ...diagnostics,
          { code: "ambiguous-candidates", level: "info", message: "Multiple React attribute matches" },
        ]);
      }
    }
  }

  if (classNames !== undefined && classNames.length > 0 && candidates.length === 0) {
    const classMatches = intrinsicElements.filter((element) => {
      if (tagName !== undefined && element.tagName !== tagName) {
        return false;
      }
      return classNames.every((className) => element.classNames.includes(className));
    });
    if (classMatches.length === 1) {
      pushCandidate(
        candidateFromElement(classMatches[0]!, "medium", "static-source-index", [
          { kind: "attribute", matched: true, value: "className" },
        ]),
      );
    } else if (classMatches.length > 1) {
      for (const match of classMatches) {
        pushCandidate(
          candidateFromElement(match, "medium", "static-source-index", [
            { kind: "attribute", matched: true, value: "className" },
          ]),
        );
      }
      return createSourceMappingResult(candidates, [
        ...diagnostics,
        { code: "ambiguous-candidates", level: "info", message: "Multiple React class matches" },
      ]);
    }
  }

  if (componentName) {
    const nameMatches = componentElements.filter(
      (element) => element.componentName === componentName,
    );

    if (attributes && Object.keys(attributes).length > 0) {
      const attributeMatches = nameMatches.filter(
        (element) => reactAttributesMatch(element, attributes) > 0,
      );
      if (attributeMatches.length === 1 && candidates.length === 0) {
        pushCandidate(
          candidateFromElement(attributeMatches[0]!, "high", "component-match", [
            { kind: "component-name", matched: true, value: componentName.slice(0, 128) },
            { kind: "attribute", matched: true, value: "stable-prop" },
          ]),
        );
      } else if (attributeMatches.length > 1) {
        for (const match of attributeMatches) {
          pushCandidate(
            candidateFromElement(match, "high", "component-match", [
              { kind: "component-name", matched: true, value: componentName.slice(0, 128) },
              { kind: "attribute", matched: true, value: "stable-prop" },
            ]),
          );
        }
        if (candidates.length > 1) {
          return createSourceMappingResult(candidates, [
            ...diagnostics,
            {
              code: "ambiguous-candidates",
              level: "info",
              message: "Multiple React component attribute matches",
            },
          ]);
        }
      }
    }

    if (nameMatches.length === 1 && candidates.length === 0) {
      pushCandidate(
        candidateFromElement(nameMatches[0]!, "medium", "component-match", [
          { kind: "component-name", matched: true, value: componentName.slice(0, 128) },
        ]),
      );
    } else if (nameMatches.length > 1 && candidates.length === 0) {
      const stablePropMatches = nameMatches.filter((element) => {
        if (accessibleName !== undefined && element.staticAccessibleName === accessibleName) {
          return true;
        }
        if (visibleText !== undefined && element.staticVisibleText === visibleText) {
          return true;
        }
        if (elementId !== undefined && element.staticProps.id === elementId) {
          return true;
        }
        const testId = attributes?.["data-testid"];
        return testId !== undefined && element.staticProps["data-testid"] === testId;
      });
      if (stablePropMatches.length === 1) {
        pushCandidate(
          candidateFromElement(stablePropMatches[0]!, "high", "component-match", [
            { kind: "component-name", matched: true, value: componentName.slice(0, 128) },
            { kind: "attribute", matched: true, value: "stable-prop" },
          ]),
        );
      } else {
        for (const match of nameMatches) {
          pushCandidate(
            candidateFromElement(match, "medium", "component-match", [
              { kind: "component-name", matched: true, value: componentName.slice(0, 128) },
            ]),
          );
        }
        if (candidates.length > 1) {
          return createSourceMappingResult(candidates, [
            ...diagnostics,
            {
              code: "ambiguous-candidates",
              level: "info",
              message: "Multiple React component usages",
            },
          ]);
        }
      }
    }
  }

  if (visibleText !== undefined || accessibleName !== undefined) {
    const text = visibleText ?? accessibleName!;
    const textMatches = intrinsicElements.filter((element) => {
      if (tagName !== undefined && element.tagName !== tagName) {
        return false;
      }
      return reactTextMatches(element, text);
    });

    if (textMatches.length === 1 && candidates.length === 0) {
      pushCandidate(
        candidateFromElement(textMatches[0]!, tagName ? "medium" : "low", "text-match", [
          { kind: "visible-text", matched: true, value: text.slice(0, 128) },
        ]),
      );
    } else if (textMatches.length > 1) {
      for (const match of textMatches) {
        pushCandidate(
          candidateFromElement(match, tagName ? "medium" : "low", "text-match", [
            { kind: "visible-text", matched: true, value: text.slice(0, 128) },
          ]),
        );
      }
      if (candidates.length > 1) {
        return createSourceMappingResult(candidates, [
          ...diagnostics,
          { code: "ambiguous-candidates", level: "info", message: "Multiple React text matches" },
        ]);
      }
    }

    if (componentName && candidates.length === 0) {
      const componentTextMatches = componentElements.filter(
        (element) =>
          element.componentName === componentName &&
          (element.staticVisibleText === text || element.staticAccessibleName === text),
      );
      if (componentTextMatches.length === 1) {
        pushCandidate(
          candidateFromElement(componentTextMatches[0]!, "medium", "text-match", [
            { kind: "visible-text", matched: true, value: text.slice(0, 128) },
            { kind: "component-name", matched: true, value: componentName.slice(0, 128) },
          ]),
        );
      } else if (componentTextMatches.length > 1) {
        for (const match of componentTextMatches) {
          pushCandidate(
            candidateFromElement(match, "medium", "text-match", [
              { kind: "visible-text", matched: true, value: text.slice(0, 128) },
            ]),
          );
        }
        return createSourceMappingResult(candidates, [
          ...diagnostics,
          { code: "ambiguous-candidates", level: "info", message: "Multiple React component text matches" },
        ]);
      }
    }
  }

  if (evidence.route !== undefined && candidates.length === 0) {
    diagnostics.push({
      code: "missing-source-location",
      level: "info",
      message: "Route is retained as context only in React static mapping",
    });
  }

  if (ownerComponent !== undefined && candidates.length === 0 && flattened.elements.length > 0) {
    diagnostics.push({
      code: "missing-source-location",
      level: "info",
      message: "Owner component alone did not produce a React candidate",
    });
  }

  return createSourceMappingResult(candidates, diagnostics);
}
