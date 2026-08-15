import type { HtmlSourceElement, VueSourceElement } from "@a11yst/types";
import { parseHtmlSelector, selectorMatchesElement } from "@a11yst/source-mapping-html";
import { componentNameAliases } from "./sanitize.js";

export type VueSelectorParseResult =
  | { ok: true; selector: string }
  | { ok: false; code: "invalid-vue-selector" | "unsupported-vue-selector" };

export function parseVueSelector(selector: string): VueSelectorParseResult {
  const parsed = parseHtmlSelector(selector);
  if (!parsed.ok) {
    return {
      ok: false,
      code: parsed.code === "invalid-html-selector" ? "invalid-vue-selector" : "unsupported-vue-selector",
    };
  }
  return parsed;
}

function toHtmlElement(element: VueSourceElement): HtmlSourceElement | undefined {
  if (element.elementKind !== "native" || !element.tagName) {
    return undefined;
  }
  const idValue = element.staticAttributes.id;
  return {
    uri: element.uri,
    region: element.region,
    tagName: element.tagName,
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
  elements: VueSourceElement[],
  selector: string,
): { matches: VueSourceElement[] } {
  const matches = elements.filter((element) => {
    const htmlLike = toHtmlElement(element);
    if (!htmlLike) {
      return false;
    }
    return selectorMatchesElement(htmlLike, selector);
  });
  return { matches };
}

export function matchNativeElementsById(
  elements: VueSourceElement[],
  elementId: string,
  tagName?: string,
): VueSourceElement[] {
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

export function vueAttributesMatch(
  element: VueSourceElement,
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

export function vueTextMatches(element: VueSourceElement, text: string): boolean {
  return element.staticVisibleText === text || element.staticAccessibleName === text;
}

export function matchComponentByName(
  elements: VueSourceElement[],
  componentName: string,
): VueSourceElement[] {
  const aliases = new Set(componentNameAliases(componentName));
  return elements.filter(
    (element) =>
      element.elementKind === "component" &&
      element.componentName !== undefined &&
      aliases.has(element.componentName),
  );
}

export { parseHtmlSelector };
