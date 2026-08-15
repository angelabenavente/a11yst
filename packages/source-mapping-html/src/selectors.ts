import {
  AttributeAction,
  parse as parseSelector,
  SelectorType,
  type Selector,
} from "css-what";
import type { HtmlSourceElement } from "@a11yst/types";
import { UNSUPPORTED_SELECTOR_PSEUDOS } from "./constants.js";

export type SelectorParseResult =
  | { ok: true; selector: string }
  | { ok: false; code: "invalid-html-selector" | "unsupported-html-selector" };

const TRAVERSAL_TYPES = new Set<Selector["type"]>([
  SelectorType.Adjacent,
  SelectorType.Child,
  SelectorType.Descendant,
  SelectorType.Parent,
  SelectorType.Sibling,
  SelectorType.ColumnCombinator,
]);

function containsUnsupportedSelector(tokens: Selector[]): boolean {
  for (const token of tokens) {
    if (TRAVERSAL_TYPES.has(token.type)) {
      return true;
    }
    if (token.type === SelectorType.Pseudo && UNSUPPORTED_SELECTOR_PSEUDOS.has(token.name)) {
      return true;
    }
  }
  return false;
}

export function parseHtmlSelector(selector: string): SelectorParseResult {
  try {
    const parsed = parseSelector(selector);
    for (const group of parsed) {
      if (containsUnsupportedSelector(group)) {
        return { ok: false, code: "unsupported-html-selector" };
      }
    }
    return { ok: true, selector };
  } catch {
    return { ok: false, code: "invalid-html-selector" };
  }
}

function tokenMatchesElement(element: HtmlSourceElement, token: Selector): boolean {
  switch (token.type) {
    case SelectorType.Tag:
      return element.tagName === token.name.toLowerCase();
    case SelectorType.Universal:
      return true;
    case SelectorType.Attribute: {
      const attrName = token.name.toLowerCase();
      if (attrName === "class") {
        if (token.action === AttributeAction.Equals) {
          return element.classNames.includes(token.value);
        }
        return element.classNames.length > 0;
      }
      if (attrName === "id") {
        if (token.action === AttributeAction.Equals) {
          return element.id === token.value;
        }
        return element.id !== undefined;
      }
      const attrValue = element.attributes[attrName];
      if (token.action === AttributeAction.Exists || token.action === AttributeAction.Any) {
        return attrValue !== undefined;
      }
      if (token.action === AttributeAction.Equals) {
        return attrValue === token.value;
      }
      return attrValue !== undefined;
    }
    default:
      return false;
  }
}

export function selectorMatchesElement(element: HtmlSourceElement, selector: string): boolean {
  const parsedResult = parseHtmlSelector(selector);
  if (!parsedResult.ok) {
    return false;
  }

  let groups: Selector[][];
  try {
    groups = parseSelector(selector);
  } catch {
    return false;
  }

  return groups.some((group) => group.every((token) => tokenMatchesElement(element, token)));
}

export function matchElementsBySelector(
  elements: HtmlSourceElement[],
  selector: string,
): HtmlSourceElement[] {
  return elements.filter((element) => selectorMatchesElement(element, selector));
}

export function matchElementsById(
  elements: HtmlSourceElement[],
  elementId: string,
  tagName?: string,
): HtmlSourceElement[] {
  return elements.filter((element) => {
    if (element.id !== elementId) {
      return false;
    }
    if (tagName !== undefined && element.tagName !== tagName.toLowerCase()) {
      return false;
    }
    return true;
  });
}

export function classNamesMatch(element: HtmlSourceElement, classNames: string[]): boolean {
  return classNames.every((className) => element.classNames.includes(className));
}

export function attributesMatch(
  element: HtmlSourceElement,
  attributes: Record<string, string>,
): number {
  let matches = 0;
  for (const [name, value] of Object.entries(attributes)) {
    const lower = name.toLowerCase();
    if (lower === "class") {
      if (classNamesMatch(element, value.split(/\s+/).filter(Boolean))) {
        matches += 1;
      }
      continue;
    }
    if (lower === "id") {
      if (element.id === value) {
        matches += 1;
      }
      continue;
    }
    if (element.attributes[lower] === value) {
      matches += 1;
    }
  }
  return matches;
}

export function textMatches(element: HtmlSourceElement, text: string): boolean {
  return element.staticVisibleText === text || element.staticAccessibleName === text;
}
