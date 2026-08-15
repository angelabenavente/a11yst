import type { SourceRegion } from "@a11yst/types";
import type { DefaultTreeAdapterMap } from "parse5";
import type { HtmlSourceElement } from "@a11yst/types";
import { EXCLUDED_CONTENT_TAGS } from "./constants.js";
import {
  filterAllowedAttributes,
  normalizeText,
  parseClassNames,
  truncateText,
} from "./sanitize.js";

type Element = DefaultTreeAdapterMap["element"];
type Node = DefaultTreeAdapterMap["node"];
type TextNode = DefaultTreeAdapterMap["textNode"];

function parse5LocationToRegion(location: {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}): SourceRegion {
  return {
    start: {
      line: location.startLine,
      column: location.startCol + 1,
    },
    end: {
      line: location.endLine,
      column: location.endCol + 1,
    },
  };
}

function getStartTagRegion(element: Element): SourceRegion | undefined {
  const tag = element.sourceCodeLocation?.startTag;
  if (!tag) {
    return undefined;
  }
  return parse5LocationToRegion({
    startLine: tag.startLine,
    startCol: tag.startCol,
    endLine: tag.endLine,
    endCol: tag.endCol,
  });
}

function attrsToRecord(element: Element): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const attr of element.attrs) {
    raw[attr.name.toLowerCase()] = attr.value;
  }
  return filterAllowedAttributes(raw);
}

function collectStaticText(node: Node, excluded: boolean): string {
  if (excluded) {
    return "";
  }

  if (node.nodeName === "#text") {
    return (node as TextNode).value;
  }

  if (node.nodeName === "#comment") {
    return "";
  }

  const element = node as Element;
  if (!element.tagName) {
    return "";
  }

  const tag = element.tagName.toLowerCase();
  const skip = EXCLUDED_CONTENT_TAGS.has(tag);
  let text = "";
  for (const child of element.childNodes) {
    text += collectStaticText(child, skip);
  }
  return text;
}

function deriveStaticAccessibleName(
  tagName: string,
  attributes: Record<string, string>,
  staticVisibleText: string | undefined,
): string | undefined {
  if (attributes["aria-label"]) {
    return attributes["aria-label"];
  }
  if (tagName === "img" && attributes.alt) {
    return attributes.alt;
  }
  if ((tagName === "button" || tagName === "a" || tagName === "label") && staticVisibleText) {
    return staticVisibleText;
  }
  if (attributes.title) {
    return attributes.title;
  }
  return undefined;
}

export function extractHtmlElements(input: {
  uri: string;
  document: DefaultTreeAdapterMap["document"];
  scopeIds: string[];
  projectNames?: string[];
  frameworks?: string[];
  maxElements: number;
  maxTextLength: number;
}): { elements: HtmlSourceElement[]; truncated: boolean } {
  const elements: HtmlSourceElement[] = [];
  let truncated = false;

  const walk = (nodes: Node[], parentExcluded: boolean): void => {
    for (const node of nodes) {
      if (truncated) {
        return;
      }

      if (node.nodeName === "#text" || node.nodeName === "#comment") {
        continue;
      }

      const element = node as Element;
      const tagName = element.tagName?.toLowerCase();
      if (!tagName) {
        continue;
      }

      const region = getStartTagRegion(element);
      if (region !== undefined) {
        const attributes = attrsToRecord(element);
        const classNames = parseClassNames(
          element.attrs.find((attr) => attr.name.toLowerCase() === "class")?.value,
        );
        delete attributes.class;

        const rawText = normalizeText(collectStaticText(element, false));
        const staticVisibleText =
          rawText && !EXCLUDED_CONTENT_TAGS.has(tagName)
            ? truncateText(rawText, input.maxTextLength)
            : undefined;
        const staticAccessibleName = deriveStaticAccessibleName(
          tagName,
          attributes,
          staticVisibleText,
        );

        const entry: HtmlSourceElement = {
          uri: input.uri,
          region,
          tagName,
          classNames,
          attributes,
          scopeIds: [...input.scopeIds],
        };

        if (attributes.id) {
          entry.id = attributes.id;
        }
        if (staticVisibleText) {
          entry.staticVisibleText = staticVisibleText;
        }
        if (staticAccessibleName) {
          entry.staticAccessibleName = staticAccessibleName;
        }
        if (input.projectNames !== undefined && input.projectNames.length > 0) {
          entry.projectNames = [...input.projectNames];
        }
        if (input.frameworks !== undefined && input.frameworks.length > 0) {
          entry.frameworks = [...input.frameworks];
        }

        elements.push(entry);
        if (elements.length >= input.maxElements) {
          truncated = true;
          return;
        }
      }

      const skip = parentExcluded || EXCLUDED_CONTENT_TAGS.has(tagName);
      walk(element.childNodes, skip);
    }
  };

  walk(input.document.childNodes, false);
  return { elements, truncated };
}

export function compareHtmlElements(left: HtmlSourceElement, right: HtmlSourceElement): number {
  const uriOrder = left.uri.localeCompare(right.uri);
  if (uriOrder !== 0) {
    return uriOrder;
  }
  if (left.region.start.line !== right.region.start.line) {
    return left.region.start.line - right.region.start.line;
  }
  const leftColumn = left.region.start.column ?? 0;
  const rightColumn = right.region.start.column ?? 0;
  if (leftColumn !== rightColumn) {
    return leftColumn - rightColumn;
  }
  return left.tagName.localeCompare(right.tagName);
}

export function sortHtmlElements(elements: HtmlSourceElement[]): HtmlSourceElement[] {
  return [...elements].sort(compareHtmlElements);
}
