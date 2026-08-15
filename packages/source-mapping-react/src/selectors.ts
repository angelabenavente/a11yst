import type { HtmlSourceElement, ReactSourceElement } from "@a11yst/types";
import { parseHtmlSelector, selectorMatchesElement } from "@a11yst/source-mapping-html";

export type ReactSelectorParseResult =
  | { ok: true; selector: string }
  | { ok: false; code: "invalid-react-selector" | "unsupported-react-selector" };

export function parseReactSelector(selector: string): ReactSelectorParseResult {
  const parsed = parseHtmlSelector(selector);
  if (!parsed.ok) {
    return {
      ok: false,
      code:
        parsed.code === "invalid-html-selector"
          ? "invalid-react-selector"
          : "unsupported-react-selector",
    };
  }
  return parsed;
}

function toHtmlLikeElement(element: ReactSourceElement): HtmlSourceElement | undefined {
  if (element.elementKind !== "intrinsic" || !element.tagName) {
    return undefined;
  }

  const attributes: Record<string, string> = {};
  for (const [name, value] of Object.entries(element.staticProps)) {
    if (name === "id" || name === "className") {
      continue;
    }
    attributes[name.toLowerCase()] = String(value);
  }

  const htmlElement: HtmlSourceElement = {
    uri: element.uri,
    region: element.region,
    tagName: element.tagName,
    classNames: element.classNames,
    attributes,
    scopeIds: element.scopeIds,
  };

  const id = element.staticProps.id;
  if (typeof id === "string") {
    htmlElement.id = id;
  }

  return htmlElement;
}

export function matchIntrinsicElementsBySelector(
  elements: readonly ReactSourceElement[],
  selector: string,
): { matches: ReactSourceElement[]; error?: "invalid-react-selector" | "unsupported-react-selector" } {
  const parsed = parseReactSelector(selector);
  if (!parsed.ok) {
    return { matches: [], error: parsed.code };
  }

  const matches = elements.filter((element) => {
    const htmlLike = toHtmlLikeElement(element);
    if (!htmlLike) {
      return false;
    }
    return selectorMatchesElement(htmlLike, selector);
  });

  matches.sort((left, right) => {
    const uriOrder = left.uri.localeCompare(right.uri);
    if (uriOrder !== 0) {
      return uriOrder;
    }
    const lineOrder = left.region.start.line - right.region.start.line;
    if (lineOrder !== 0) {
      return lineOrder;
    }
    return (left.region.start.column ?? 0) - (right.region.start.column ?? 0);
  });

  return { matches };
}

export function matchIntrinsicElementsById(
  elements: readonly ReactSourceElement[],
  elementId: string,
  tagName?: string,
): ReactSourceElement[] {
  return elements.filter((element) => {
    if (element.elementKind !== "intrinsic" || !element.tagName) {
      return false;
    }
    if (element.staticProps.id !== elementId) {
      return false;
    }
    if (tagName !== undefined && element.tagName !== tagName.toLowerCase()) {
      return false;
    }
    return true;
  }).sort((left, right) => {
    const uriOrder = left.uri.localeCompare(right.uri);
    if (uriOrder !== 0) {
      return uriOrder;
    }
    const lineOrder = left.region.start.line - right.region.start.line;
    if (lineOrder !== 0) {
      return lineOrder;
    }
    return (left.region.start.column ?? 0) - (right.region.start.column ?? 0);
  });
}

export function reactAttributesMatch(
  element: ReactSourceElement,
  attributes: Record<string, string>,
): number {
  if (element.elementKind === "intrinsic") {
    const htmlLike = toHtmlLikeElement(element);
    if (!htmlLike) {
      return 0;
    }
  }

  let matches = 0;
  for (const [name, value] of Object.entries(attributes)) {
    const lower = name.toLowerCase();
    if (lower === "class" || lower === "classname") {
      const tokens = value.split(/\s+/).filter(Boolean);
      if (tokens.every((token) => element.classNames.includes(token))) {
        matches += 1;
      }
      continue;
    }
    if (lower === "id") {
      if (element.staticProps.id === value) {
        matches += 1;
      }
      continue;
    }
    const propValue = element.staticProps[lower] ?? element.staticProps[name];
    if (propValue !== undefined && String(propValue) === value) {
      matches += 1;
    }
  }
  return matches;
}

export function reactTextMatches(element: ReactSourceElement, text: string): boolean {
  return element.staticVisibleText === text || element.staticAccessibleName === text;
}
