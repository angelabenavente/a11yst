import {
  BindingType,
  parseTemplate,
  TmplAstBoundText,
  TmplAstContent,
  TmplAstDeferredBlock,
  TmplAstDeferredBlockError,
  TmplAstDeferredBlockLoading,
  TmplAstDeferredBlockPlaceholder,
  TmplAstElement,
  TmplAstForLoopBlock,
  TmplAstForLoopBlockEmpty,
  TmplAstIfBlock,
  TmplAstIfBlockBranch,
  TmplAstSwitchBlock,
  TmplAstSwitchBlockCase,
  TmplAstTemplate,
  TmplAstText,
} from "@angular/compiler";
import type {
  AngularSourceDiagnostic,
  AngularSourceElement,
  AngularTemplateKind,
  SourceRegion,
} from "@a11yst/types";
import type ts from "typescript";
import {
  ACCESSIBLE_NAME_TAGS,
  ALLOWED_STATIC_ATTRIBUTES,
  BOOLEAN_ATTRIBUTES,
  EXCLUDED_ATTRIBUTES,
  STRUCTURAL_TAGS,
} from "./constants.js";
import { createAngularDiagnostic } from "./diagnostics.js";
import {
  isNativeHtmlTag,
  isSensitiveValue,
  normalizeText,
  sortStringArray,
  truncateText,
} from "./sanitize.js";

export type ComponentLookup = Map<string, { className?: string; componentSelector?: string }>;

export type ParseTemplateContext = {
  uri: string;
  templateKind: AngularTemplateKind;
  ownerComponent?: string;
  componentSelector?: string;
  scopeIds: string[];
  projectNames?: string[];
  maxElements: number;
  maxAttributes: number;
  maxTextLength: number;
  inlineTemplateStart?: number;
  sourceText?: string;
  sourceFile?: ts.SourceFile;
  componentLookup: ComponentLookup;
};

export type ParseTemplateResult = {
  elements: AngularSourceElement[];
  diagnostics: AngularSourceDiagnostic[];
  summary: {
    nativeElements: number;
    componentUsages: number;
    dynamicBindings: number;
    eventBindings: number;
    twoWayBindings: number;
    structuralDirectives: number;
    controlFlowBlocks: number;
  };
};

type RenderFlags = {
  conditional?: boolean;
  repeated?: boolean;
  deferred?: boolean;
};

function regionFromSpan(
  span: { start: { offset: number; line: number; col: number }; end: { offset: number; line: number; col: number } },
  context: ParseTemplateContext,
): SourceRegion {
  if (context.templateKind === "inline" && context.inlineTemplateStart !== undefined && context.sourceFile) {
    const absoluteStart = context.inlineTemplateStart + span.start.offset;
    const absoluteEnd = context.inlineTemplateStart + span.end.offset;
    const start = context.sourceFile.getLineAndCharacterOfPosition(absoluteStart);
    const end = context.sourceFile.getLineAndCharacterOfPosition(absoluteEnd);
    return {
      start: { line: start.line + 1, column: start.character + 1 },
      end: { line: end.line + 1, column: end.character + 1 },
    };
  }

  return {
    start: { line: span.start.line + 1, column: span.start.col + 1 },
    end: { line: span.end.line + 1, column: span.end.col + 1 },
  };
}

function deriveAccessibleName(
  tagName: string | undefined,
  staticAttributes: Record<string, string | number | boolean>,
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

function extractStaticText(nodes: unknown[], maxTextLength: number): { text?: string; hasDynamic: boolean } {
  const parts: string[] = [];
  let hasDynamic = false;

  for (const node of nodes) {
    if (node instanceof TmplAstText) {
      const normalized = normalizeText(node.value);
      if (normalized) {
        parts.push(normalized);
      }
      continue;
    }
    if (node instanceof TmplAstBoundText) {
      hasDynamic = true;
      continue;
    }
    if (node instanceof TmplAstElement) {
      const nested = extractStaticText(node.children, maxTextLength);
      if (nested.hasDynamic) {
        hasDynamic = true;
      }
      if (nested.text) {
        parts.push(nested.text);
      }
      continue;
    }
    if (node instanceof TmplAstTemplate || node instanceof TmplAstIfBlock || node instanceof TmplAstIfBlockBranch) {
      const children = "children" in node ? node.children : [];
      const nested = extractStaticText(children, maxTextLength);
      if (nested.hasDynamic) {
        hasDynamic = true;
      }
      if (nested.text) {
        parts.push(nested.text);
      }
    }
  }

  if (hasDynamic) {
    return { hasDynamic: true };
  }
  const combined = parts.join(" ");
  if (!combined) {
    return { hasDynamic: false };
  }
  return { text: truncateText(combined, maxTextLength), hasDynamic: false };
}

function processAttributes(
  element: TmplAstElement,
  context: ParseTemplateContext,
  diagnostics: AngularSourceDiagnostic[],
  counters: ParseTemplateResult["summary"],
): {
  staticAttributes: Record<string, string | number | boolean>;
  dynamicAttributeNames: string[];
  classNames: string[];
  hasAttributeSpread: boolean;
} {
  const staticAttributes: Record<string, string | number | boolean> = {};
  const dynamicAttributeNames: string[] = [];
  const classNames: string[] = [];
  const hasAttributeSpread = false;

  for (const attribute of element.attributes) {
    const name = attribute.name.toLowerCase();
    if (EXCLUDED_ATTRIBUTES.has(name)) {
      continue;
    }
    if (name === "class") {
      const value = attribute.value.trim();
      for (const token of value.split(/\s+/).filter(Boolean)) {
        classNames.push(token);
      }
      continue;
    }
    if (!ALLOWED_STATIC_ATTRIBUTES.has(name)) {
      continue;
    }
    if (isSensitiveValue(attribute.value)) {
      diagnostics.push(createAngularDiagnostic("angular-sensitive-value-redacted", "info", context.uri, context.ownerComponent));
      continue;
    }
    if (BOOLEAN_ATTRIBUTES.has(name) && attribute.value === "") {
      staticAttributes[name] = true;
    } else {
      staticAttributes[name] = attribute.value;
    }
  }

  for (const input of element.inputs) {
    const name = input.name.toLowerCase();
    if (input.type === BindingType.TwoWay) {
      counters.twoWayBindings += 1;
      dynamicAttributeNames.push(name === "ngmodel" ? "ngModel" : name);
      continue;
    }
    if (name.startsWith("attr.")) {
      dynamicAttributeNames.push(name.slice(5));
      counters.dynamicBindings += 1;
      continue;
    }
    if (name === "class" || name === "ngclass") {
      dynamicAttributeNames.push("class");
      counters.dynamicBindings += 1;
      continue;
    }
    dynamicAttributeNames.push(name);
    counters.dynamicBindings += 1;
  }

  for (const _output of element.outputs) {
    counters.eventBindings += 1;
  }

  return {
    staticAttributes,
    dynamicAttributeNames: sortStringArray(dynamicAttributeNames),
    classNames: sortStringArray(classNames),
    hasAttributeSpread,
  };
}

function processElement(
  element: TmplAstElement,
  context: ParseTemplateContext,
  elements: AngularSourceElement[],
  diagnostics: AngularSourceDiagnostic[],
  counters: ParseTemplateResult["summary"],
  flags: RenderFlags,
): void {
  if (elements.length >= context.maxElements) {
    return;
  }

  const tagLower = element.name.toLowerCase();
  if (STRUCTURAL_TAGS.has(tagLower)) {
    for (const child of element.children) {
      visitNode(child, context, elements, diagnostics, counters, {
        conditional: flags.conditional ?? tagLower === "ng-template",
        repeated: flags.repeated,
        deferred: flags.deferred,
      });
    }
    return;
  }

  const startSpan = element.startSourceSpan ?? element.sourceSpan;
  const region = regionFromSpan(startSpan, context);
  const attrs = processAttributes(element, context, diagnostics, counters);
  const textResult = extractStaticText(element.children, context.maxTextLength);

  const elementFlags = {
    hasConditionalRendering: flags.conditional ?? false,
    hasRepeatedRendering: flags.repeated ?? false,
    hasDeferredRendering: flags.deferred ?? false,
  };

  if (isNativeHtmlTag(tagLower)) {
    const staticVisibleText = textResult.hasDynamic ? undefined : textResult.text;
    const item: AngularSourceElement = {
      uri: context.uri,
      region,
      elementKind: "native",
      tagName: tagLower,
      ownerComponent: context.ownerComponent,
      componentSelector: context.componentSelector,
      staticAttributes: attrs.staticAttributes,
      dynamicAttributeNames: attrs.dynamicAttributeNames,
      classNames: attrs.classNames,
      hasAttributeSpread: attrs.hasAttributeSpread,
      ...elementFlags,
      templateKind: context.templateKind,
      scopeIds: [...context.scopeIds],
    };
    if (context.projectNames) {
      item.projectNames = [...context.projectNames];
    }
    if (staticVisibleText) {
      item.staticVisibleText = staticVisibleText;
    }
    const accessibleName = deriveAccessibleName(tagLower, attrs.staticAttributes, staticVisibleText);
    if (accessibleName) {
      item.staticAccessibleName = accessibleName;
    }
    elements.push(item);
    counters.nativeElements += 1;
  } else {
    const lookup = context.componentLookup.get(tagLower);
    const item: AngularSourceElement = {
      uri: context.uri,
      region,
      elementKind: "component",
      componentName: lookup?.className,
      ownerComponent: context.ownerComponent,
      componentSelector: lookup?.componentSelector ?? tagLower,
      staticAttributes: attrs.staticAttributes,
      dynamicAttributeNames: attrs.dynamicAttributeNames,
      classNames: attrs.classNames,
      hasAttributeSpread: attrs.hasAttributeSpread,
      ...elementFlags,
      templateKind: context.templateKind,
      scopeIds: [...context.scopeIds],
    };
    if (context.projectNames) {
      item.projectNames = [...context.projectNames];
    }
    if (textResult.text && !textResult.hasDynamic) {
      item.staticVisibleText = textResult.text;
    }
    elements.push(item);
    counters.componentUsages += 1;
  }

  for (const child of element.children) {
    visitNode(child, context, elements, diagnostics, counters, flags);
  }
}

function visitChildren(
  children: unknown[],
  context: ParseTemplateContext,
  elements: AngularSourceElement[],
  diagnostics: AngularSourceDiagnostic[],
  counters: ParseTemplateResult["summary"],
  flags: RenderFlags,
): void {
  for (const child of children) {
    visitNode(child, context, elements, diagnostics, counters, flags);
  }
}

function visitNode(
  node: unknown,
  context: ParseTemplateContext,
  elements: AngularSourceElement[],
  diagnostics: AngularSourceDiagnostic[],
  counters: ParseTemplateResult["summary"],
  flags: RenderFlags = {},
): void {
  if (node instanceof TmplAstElement) {
    processElement(node, context, elements, diagnostics, counters, flags);
    return;
  }
  if (node instanceof TmplAstTemplate) {
    for (const attr of node.templateAttrs) {
      if (attr.name.startsWith("*")) {
        counters.structuralDirectives += 1;
      }
    }
    const repeated = flags.repeated || node.templateAttrs.some((attr) => attr.name === "ngFor");
    const conditional = flags.conditional || node.templateAttrs.some((attr) =>
      attr.name === "ngIf" || attr.name === "ngSwitchCase",
    );
    visitChildren(node.children, context, elements, diagnostics, counters, {
      ...flags,
      conditional,
      repeated,
    });
    return;
  }
  if (node instanceof TmplAstContent) {
    diagnostics.push(createAngularDiagnostic("angular-content-projection-unresolved", "info", context.uri, context.ownerComponent));
    visitChildren(node.children, context, elements, diagnostics, counters, flags);
    return;
  }
  if (node instanceof TmplAstIfBlock) {
    counters.controlFlowBlocks += 1;
    for (const branch of node.branches) {
      visitNode(branch, context, elements, diagnostics, counters, { ...flags, conditional: true });
    }
    return;
  }
  if (node instanceof TmplAstIfBlockBranch) {
    visitChildren(node.children, context, elements, diagnostics, counters, flags);
    return;
  }
  if (node instanceof TmplAstForLoopBlock) {
    counters.controlFlowBlocks += 1;
    visitChildren(node.children, context, elements, diagnostics, counters, { ...flags, repeated: true });
    if (node.empty) {
      visitNode(node.empty, context, elements, diagnostics, counters, flags);
    }
    return;
  }
  if (node instanceof TmplAstForLoopBlockEmpty) {
    visitChildren(node.children, context, elements, diagnostics, counters, flags);
    return;
  }
  if (node instanceof TmplAstSwitchBlock) {
    counters.controlFlowBlocks += 1;
    for (const branchCase of node.cases) {
      visitNode(branchCase, context, elements, diagnostics, counters, { ...flags, conditional: true });
    }
    return;
  }
  if (node instanceof TmplAstSwitchBlockCase) {
    visitChildren(node.children, context, elements, diagnostics, counters, flags);
    return;
  }
  if (node instanceof TmplAstDeferredBlock) {
    counters.controlFlowBlocks += 1;
    visitChildren(node.children, context, elements, diagnostics, counters, { ...flags, deferred: true });
    if (node.placeholder) {
      visitNode(node.placeholder, context, elements, diagnostics, counters, { ...flags, deferred: true });
    }
    if (node.loading) {
      visitNode(node.loading, context, elements, diagnostics, counters, { ...flags, deferred: true });
    }
    if (node.error) {
      visitNode(node.error, context, elements, diagnostics, counters, { ...flags, deferred: true });
    }
    return;
  }
  if (
    node instanceof TmplAstDeferredBlockPlaceholder
    || node instanceof TmplAstDeferredBlockLoading
    || node instanceof TmplAstDeferredBlockError
  ) {
    visitChildren(node.children, context, elements, diagnostics, counters, flags);
  }
}

export function parseAngularTemplate(
  templateSource: string,
  context: ParseTemplateContext,
): ParseTemplateResult {
  const diagnostics: AngularSourceDiagnostic[] = [];
  const elements: AngularSourceElement[] = [];
  const summary = {
    nativeElements: 0,
    componentUsages: 0,
    dynamicBindings: 0,
    eventBindings: 0,
    twoWayBindings: 0,
    structuralDirectives: 0,
    controlFlowBlocks: 0,
  };

  const parsed = parseTemplate(templateSource, context.uri, { preserveWhitespaces: false });
  if (parsed.errors !== null && parsed.errors.length > 0) {
    diagnostics.push(createAngularDiagnostic("angular-template-parse-warning", "warning", context.uri, context.ownerComponent));
  }

  for (const node of parsed.nodes) {
    visitNode(node, context, elements, diagnostics, summary);
  }

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
