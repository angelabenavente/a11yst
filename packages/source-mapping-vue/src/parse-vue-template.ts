import { parse as parseSfc } from "@vue/compiler-sfc";
import { NodeTypes, parse as parseTemplate } from "@vue/compiler-dom";
import { isHTMLTag, isSVGTag, isMathMLTag } from "@vue/shared";
import type {
  SourceRegion,
  VueSourceDiagnostic,
  VueSourceElement,
  VueStaticAttributeValue,
} from "@a11yst/types";
import {
  ACCESSIBLE_NAME_TAGS,
  ALLOWED_STATIC_ATTRIBUTES,
  EXCLUDED_ATTRIBUTE_NAMES,
  STRUCTURAL_TAGS,
} from "./constants.js";
import { createVueDiagnostic } from "./diagnostics.js";
import {
  componentNameAliases,
  isSensitiveValue,
  normalizeText,
  offsetToPosition,
  ownerHintFromFilename,
  sortStringArray,
  truncateText,
} from "./sanitize.js";

export type ParseVueTemplateResult = {
  elements: VueSourceElement[];
  diagnostics: VueSourceDiagnostic[];
  summary: {
    nativeElements: number;
    componentUsages: number;
    dynamicBindings: number;
    spreadBindings: number;
    textTruncated: boolean;
  };
};

type ParseContext = {
  uri: string;
  source: string;
  templateOffset: number;
  scopeIds: string[];
  projectNames?: string[];
  ownerComponentHint?: string;
  maxElements: number;
  maxAttributes: number;
  maxTextLength: number;
};

function isNativeTag(tag: string): boolean {
  const lower = tag.toLowerCase();
  return isHTMLTag(lower) || isSVGTag(lower) || isMathMLTag(lower);
}

function isStructuralTag(tag: string): boolean {
  return STRUCTURAL_TAGS.has(tag.toLowerCase());
}

function parseLiteralExpression(content: string | undefined): VueStaticAttributeValue | undefined {
  if (content === undefined) {
    return undefined;
  }
  const trimmed = content.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }
  return undefined;
}

function regionFromLoc(
  source: string,
  startOffset: number,
  endOffset: number,
): SourceRegion {
  const start = offsetToPosition(source, startOffset);
  const end = offsetToPosition(source, endOffset);
  return {
    start: { line: start.line, column: start.column },
    end: { line: end.line, column: end.column },
  };
}

function extractStaticText(
  children: unknown[],
  maxTextLength: number,
): { text?: string; truncated: boolean } {
  const parts: string[] = [];
  let truncated = false;

  const walk = (nodes: unknown[]): boolean => {
    for (const node of nodes) {
      if (!node || typeof node !== "object") {
        continue;
      }
      const typed = node as { type?: number; content?: string; children?: unknown[] };
      if (typed.type === NodeTypes.TEXT && typeof typed.content === "string") {
        const normalized = normalizeText(typed.content);
        if (normalized) {
          parts.push(normalized);
        }
        continue;
      }
      if (typed.type === NodeTypes.ELEMENT && Array.isArray(typed.children)) {
        if (!walk(typed.children)) {
          return false;
        }
        continue;
      }
      return false;
    }
    return true;
  };

  if (!walk(children)) {
    return { truncated: false };
  }

  const combined = parts.join(" ");
  if (!combined) {
    return { truncated: false };
  }
  if (combined.length > maxTextLength) {
    truncated = true;
    return { text: truncateText(combined, maxTextLength), truncated };
  }
  return { text: combined, truncated };
}

function deriveAccessibleName(
  tagName: string | undefined,
  staticAttributes: Record<string, VueStaticAttributeValue>,
  staticVisibleText?: string,
): string | undefined {
  const ariaLabel = staticAttributes["aria-label"];
  if (typeof ariaLabel === "string" && ariaLabel) {
    return ariaLabel;
  }
  const alt = staticAttributes.alt;
  if (typeof alt === "string" && alt) {
    return alt;
  }
  const title = staticAttributes.title;
  if (typeof title === "string" && title) {
    return title;
  }
  if (tagName && ACCESSIBLE_NAME_TAGS.has(tagName) && staticVisibleText) {
    return staticVisibleText;
  }
  return undefined;
}

function processElement(
  node: {
    type: number;
    tag: string;
    props: unknown[];
    children?: unknown[];
    loc?: { start: { offset: number }; end: { offset: number } };
  },
  context: ParseContext,
  elements: VueSourceElement[],
  diagnostics: VueSourceDiagnostic[],
  summary: ParseVueTemplateResult["summary"],
): void {
  if (elements.length >= context.maxElements) {
    return;
  }

  const tag = node.tag;
  const tagLower = tag.toLowerCase();
  if (tagLower === "template") {
    return;
  }

  const startOffset = context.templateOffset + (node.loc?.start.offset ?? 0);
  const endOffset = context.templateOffset + (node.loc?.end.offset ?? startOffset);
  const region = regionFromLoc(context.source, startOffset, endOffset);

  const staticAttributes: Record<string, VueStaticAttributeValue> = {};
  const dynamicAttributeNames: string[] = [];
  const classNames: string[] = [];
  let hasSpreadBinding = false;
  let spreadMayOverrideStaticAttributes = false;

  for (const prop of node.props) {
    if (!prop || typeof prop !== "object") {
      continue;
    }
    const typed = prop as {
      type?: number;
      name?: string;
      value?: { content?: string };
      arg?: { content?: string; isStatic?: boolean };
      exp?: { content?: string; isStatic?: boolean };
    };

    if (typed.type === NodeTypes.ATTRIBUTE) {
      const name = typed.name?.toLowerCase() ?? "";
      if (EXCLUDED_ATTRIBUTE_NAMES.has(name) || name.startsWith("on") || name.startsWith("@")) {
        continue;
      }
      if (name === "class") {
        const value = typed.value?.content ?? "";
        for (const token of value.split(/\s+/).filter(Boolean)) {
          classNames.push(token);
        }
        continue;
      }
      if (!ALLOWED_STATIC_ATTRIBUTES.has(name)) {
        continue;
      }
      const raw = typed.value?.content ?? "";
      if (isSensitiveValue(raw)) {
        diagnostics.push(createVueDiagnostic("vue-sensitive-value-redacted", "info", context.uri));
        continue;
      }
      staticAttributes[name] = raw;
      continue;
    }

    if (typed.type === NodeTypes.DIRECTIVE) {
      const directiveName = typed.name ?? "";
      if (directiveName === "bind" && typed.arg === undefined && typed.exp !== undefined) {
        hasSpreadBinding = true;
        spreadMayOverrideStaticAttributes = true;
        summary.spreadBindings += 1;
        continue;
      }
      if (directiveName === "bind" || directiveName === "model" || directiveName === "html" || directiveName === "text") {
        const argName = typed.arg?.content?.toLowerCase();
        if (argName === undefined && directiveName === "bind") {
          hasSpreadBinding = true;
          spreadMayOverrideStaticAttributes = true;
          summary.spreadBindings += 1;
          continue;
        }
        if (argName && (EXCLUDED_ATTRIBUTE_NAMES.has(argName) || argName.startsWith("on"))) {
          dynamicAttributeNames.push(argName);
          summary.dynamicBindings += 1;
          continue;
        }
        const literal = parseLiteralExpression(typed.exp?.content);
        if (argName && literal !== undefined && ALLOWED_STATIC_ATTRIBUTES.has(argName)) {
          if (typeof literal === "string" && isSensitiveValue(literal)) {
            diagnostics.push(createVueDiagnostic("vue-sensitive-value-redacted", "info", context.uri));
          } else if (argName === "class") {
            if (typeof literal === "string") {
              for (const token of literal.split(/\s+/).filter(Boolean)) {
                classNames.push(token);
              }
            }
          } else {
            staticAttributes[argName] = literal;
          }
          continue;
        }
        if (argName) {
          if (!dynamicAttributeNames.includes(argName)) {
            dynamicAttributeNames.push(argName);
          }
          summary.dynamicBindings += 1;
        }
        continue;
      }
      if (directiveName === "on") {
        continue;
      }
    }
  }

  const textResult = extractStaticText(node.children ?? [], context.maxTextLength);
  if (textResult.truncated) {
    diagnostics.push(createVueDiagnostic("vue-text-truncated", "info", context.uri));
  }

  const sortedClasses = sortStringArray(classNames);
  const sortedDynamic = sortStringArray(dynamicAttributeNames);

  if (isNativeTag(tag) && !isStructuralTag(tag)) {
    const staticVisibleText = textResult.text;
    const element: VueSourceElement = {
      uri: context.uri,
      region,
      elementKind: "native",
      tagName: tagLower,
      ownerComponentHint: context.ownerComponentHint,
      staticAttributes,
      dynamicAttributeNames: sortedDynamic,
      classNames: sortedClasses,
      hasSpreadBinding,
      spreadMayOverrideStaticAttributes,
      scopeIds: [...context.scopeIds],
    };
    if (context.projectNames) {
      element.projectNames = [...context.projectNames];
    }
    if (staticVisibleText) {
      element.staticVisibleText = staticVisibleText;
    }
    const accessibleName = deriveAccessibleName(tagLower, staticAttributes, staticVisibleText);
    if (accessibleName) {
      element.staticAccessibleName = accessibleName;
    }
    elements.push(element);
    summary.nativeElements += 1;
    return;
  }

  if (isStructuralTag(tag)) {
    if (tagLower === "nuxtpage") {
      const element: VueSourceElement = {
        uri: context.uri,
        region,
        elementKind: "component",
        componentName: "NuxtPage",
        ownerComponentHint: context.ownerComponentHint,
        staticAttributes,
        dynamicAttributeNames: sortedDynamic,
        classNames: sortedClasses,
        hasSpreadBinding,
        spreadMayOverrideStaticAttributes,
        scopeIds: [...context.scopeIds],
      };
      if (context.projectNames) {
        element.projectNames = [...context.projectNames];
      }
      elements.push(element);
      summary.componentUsages += 1;
      return;
    }

    if (tagLower === "component") {
      const isDynamic = node.props.some((prop) => {
        const typed = prop as { type?: number; name?: string; arg?: { content?: string }; exp?: { content?: string } };
        return typed.type === NodeTypes.DIRECTIVE && typed.name === "bind" && typed.arg?.content === "is" && typed.exp && !parseLiteralExpression(typed.exp.content);
      });
      const staticIsProp = node.props.find((prop) => {
        const typed = prop as {
          type?: number;
          name?: string;
          arg?: { content?: string };
          exp?: { content?: string };
          value?: { content?: string };
        };
        if (typed.type === NodeTypes.DIRECTIVE && typed.name === "bind" && typed.arg?.content === "is") {
          return parseLiteralExpression(typed.exp?.content) !== undefined;
        }
        if (typed.type === NodeTypes.ATTRIBUTE && typed.name === "is") {
          return typed.value?.content !== undefined;
        }
        return false;
      }) as {
        type?: number;
        name?: string;
        exp?: { content?: string };
        value?: { content?: string };
      } | undefined;

      if (!isDynamic && staticIsProp) {
        const literal =
          parseLiteralExpression(staticIsProp.exp?.content) ??
          staticIsProp.value?.content;
        if (typeof literal === "string" && literal) {
          const element: VueSourceElement = {
            uri: context.uri,
            region,
            elementKind: "component",
            componentName: literal,
            ownerComponentHint: context.ownerComponentHint,
            staticAttributes,
            dynamicAttributeNames: sortedDynamic,
            classNames: sortedClasses,
            hasSpreadBinding,
            spreadMayOverrideStaticAttributes,
            scopeIds: [...context.scopeIds],
          };
          if (context.projectNames) {
            element.projectNames = [...context.projectNames];
          }
          elements.push(element);
          summary.componentUsages += 1;
        }
      }
    }
    return;
  }

  const componentName = tag;
  const element: VueSourceElement = {
    uri: context.uri,
    region,
    elementKind: "component",
    componentName,
    ownerComponentHint: context.ownerComponentHint,
    staticAttributes,
    dynamicAttributeNames: sortedDynamic,
    classNames: sortedClasses,
    hasSpreadBinding,
    spreadMayOverrideStaticAttributes,
    scopeIds: [...context.scopeIds],
  };
  if (context.projectNames) {
    element.projectNames = [...context.projectNames];
  }
  if (textResult.text) {
    element.staticVisibleText = textResult.text;
  }
  elements.push(element);
  summary.componentUsages += 1;
}

function walkTemplate(
  nodes: unknown[],
  context: ParseContext,
  elements: VueSourceElement[],
  diagnostics: VueSourceDiagnostic[],
  summary: ParseVueTemplateResult["summary"],
): void {
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }
    const typed = node as { type?: number; children?: unknown[] };
    if (typed.type === NodeTypes.ELEMENT) {
      processElement(node as Parameters<typeof processElement>[0], context, elements, diagnostics, summary);
      if (Array.isArray(typed.children)) {
        walkTemplate(typed.children, context, elements, diagnostics, summary);
      }
      continue;
    }
    if (typed.type === NodeTypes.IF || typed.type === NodeTypes.FOR) {
      if (Array.isArray(typed.children)) {
        walkTemplate(typed.children, context, elements, diagnostics, summary);
      }
    }
  }
}

export function parseVueSfc(input: {
  uri: string;
  source: string;
  scopeIds: string[];
  projectNames?: string[];
  maxElementsPerFile: number;
  maxAttributesPerElement: number;
  maxTextLength: number;
}): ParseVueTemplateResult {
  const diagnostics: VueSourceDiagnostic[] = [];
  const elements: VueSourceElement[] = [];
  const summary = {
    nativeElements: 0,
    componentUsages: 0,
    dynamicBindings: 0,
    spreadBindings: 0,
    textTruncated: false,
  };

  const { descriptor, errors } = parseSfc(input.source, { filename: input.uri });
  if (errors.length > 0) {
    diagnostics.push(createVueDiagnostic("vue-sfc-parse-warning", "warning", input.uri));
  }

  const template = descriptor.template;
  if (!template) {
    diagnostics.push(createVueDiagnostic("vue-template-missing", "info", input.uri));
    return { elements, diagnostics, summary };
  }

  if (template.lang && template.lang !== "html") {
    diagnostics.push(createVueDiagnostic("vue-template-language-unsupported", "warning", input.uri));
    return { elements, diagnostics, summary };
  }

  if (template.src) {
    diagnostics.push(createVueDiagnostic("vue-external-template-unsupported", "warning", input.uri));
    return { elements, diagnostics, summary };
  }

  let ast;
  try {
    ast = parseTemplate(template.content, { comments: false });
  } catch {
    diagnostics.push(createVueDiagnostic("vue-template-parse-warning", "warning", input.uri));
    return { elements, diagnostics, summary };
  }

  const templateOffset = template.loc?.start.offset ?? 0;
  const context: ParseContext = {
    uri: input.uri,
    source: input.source,
    templateOffset,
    scopeIds: input.scopeIds,
    projectNames: input.projectNames,
    ownerComponentHint: ownerHintFromFilename(input.uri),
    maxElements: input.maxElementsPerFile,
    maxAttributes: input.maxAttributesPerElement,
    maxTextLength: input.maxTextLength,
  };

  walkTemplate(ast.children, context, elements, diagnostics, summary);

  elements.sort((left, right) => {
    const uriDiff = left.uri.localeCompare(right.uri);
    if (uriDiff !== 0) {
      return uriDiff;
    }
    const lineDiff = left.region.start.line - right.region.start.line;
    if (lineDiff !== 0) {
      return lineDiff;
    }
    const columnDiff = (left.region.start.column ?? 0) - (right.region.start.column ?? 0);
    if (columnDiff !== 0) {
      return columnDiff;
    }
    const kindDiff = left.elementKind.localeCompare(right.elementKind);
    if (kindDiff !== 0) {
      return kindDiff;
    }
    const nameLeft = left.componentName ?? left.tagName ?? "";
    const nameRight = right.componentName ?? right.tagName ?? "";
    return nameLeft.localeCompare(nameRight);
  });

  return { elements, diagnostics, summary };
}

export { componentNameAliases };
