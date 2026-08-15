import type { HtmlSourceElement, AngularSourceElement } from "@a11yst/types";
import { parseHtmlSelector, selectorMatchesElement } from "@a11yst/source-mapping-html";

export type AngularSelectorParseResult =
  | { ok: true; selector: string }
  | { ok: false; code: "invalid-angular-selector" | "unsupported-angular-selector" };

export function parseAngularSelector(selector: string): AngularSelectorParseResult {
  const parsed = parseHtmlSelector(selector);
  if (!parsed.ok) {
    return {
      ok: false,
      code: parsed.code === "invalid-html-selector" ? "invalid-angular-selector" : "unsupported-angular-selector",
    };
  }
  return parsed;
}

function toHtmlElement(element: AngularSourceElement): HtmlSourceElement {
  const idValue = element.staticAttributes.id;
  return {
    uri: element.uri,
    region: element.region,
    tagName: element.tagName ?? "",
    id: typeof idValue === "string" ? idValue : undefined,
    classNames: [...element.classNames],
    attributes: Object.fromEntries(
      Object.entries(element.staticAttributes)
        .filter(([name]) => name !== "class" && name !== "id")
        .map(([name, value]) => [name, String(value)]),
    ),
    staticVisibleText: element.staticVisibleText,
    staticAccessibleName: element.staticAccessibleName,
    scopeIds: [...element.scopeIds],
    projectNames: element.projectNames ? [...element.projectNames] : undefined,
  };
}

export function matchNativeElementsBySelector(
  elements: AngularSourceElement[],
  selector: string,
): AngularSourceElement[] {
  return elements.filter((element) => {
    if (element.elementKind !== "native" || !element.tagName) {
      return false;
    }
    return selectorMatchesElement(toHtmlElement(element), selector);
  });
}

export function matchNativeElementsById(
  elements: AngularSourceElement[],
  elementId: string,
  tagName?: string,
): AngularSourceElement[] {
  return elements.filter((element) => {
    if (element.elementKind !== "native" || !element.tagName) {
      return false;
    }
    if (element.staticAttributes.id !== elementId) {
      return false;
    }
    if (tagName !== undefined && element.tagName !== tagName.toLowerCase()) {
      return false;
    }
    return true;
  });
}

export function angularAttributesMatch(
  element: AngularSourceElement,
  attributes: Record<string, string>,
): number {
  let matches = 0;
  for (const [name, value] of Object.entries(attributes)) {
    const lower = name.toLowerCase();
    if (lower === "class") {
      const tokens = value.split(/\s+/).filter(Boolean);
      if (tokens.every((token) => element.classNames.includes(token))) {
        matches += 1;
      }
      continue;
    }
    if (lower === "id") {
      if (element.staticAttributes.id === value) {
        matches += 1;
      }
      continue;
    }
    const attrValue = element.staticAttributes[lower];
    if (attrValue !== undefined && String(attrValue) === value) {
      matches += 1;
    }
  }
  return matches;
}

export function angularTextMatches(element: AngularSourceElement, text: string): boolean {
  return element.staticVisibleText === text || element.staticAccessibleName === text;
}

export function matchComponentElements(
  elements: AngularSourceElement[],
  componentName?: string,
  componentSelector?: string,
): AngularSourceElement[] {
  return elements.filter((element) => {
    if (element.elementKind !== "component") {
      return false;
    }
    if (componentName && element.componentName === componentName) {
      return true;
    }
    if (componentSelector && element.componentSelector === componentSelector) {
      return true;
    }
    return false;
  });
}
