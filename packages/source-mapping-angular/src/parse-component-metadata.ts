import ts from "typescript";
import type { AngularSourceDiagnostic, AngularTemplateKind } from "@a11yst/types";
import { createAngularDiagnostic } from "./diagnostics.js";
import { elementSelectorFromComponentSelector } from "./sanitize.js";

export type ParsedComponentMetadata = {
  className?: string;
  selector?: string;
  elementSelector?: string;
  templateKind?: AngularTemplateKind;
  templateUrl?: string;
  inlineTemplate?: string;
  inlineTemplateStart?: number;
  standalone?: boolean;
  diagnostics: AngularSourceDiagnostic[];
};

function readStaticString(node: ts.Expression | undefined): string | undefined {
  if (node === undefined) {
    return undefined;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function readStaticBoolean(node: ts.Expression | undefined): boolean | undefined {
  if (node === undefined) {
    return undefined;
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  return undefined;
}

function analyzeComponentArgument(
  argument: ts.Expression | undefined,
  diagnostics: AngularSourceDiagnostic[],
): Pick<
  ParsedComponentMetadata,
  "selector" | "elementSelector" | "templateKind" | "templateUrl" | "inlineTemplate" | "inlineTemplateStart" | "standalone"
> {
  const result: Pick<
    ParsedComponentMetadata,
    "selector" | "elementSelector" | "templateKind" | "templateUrl" | "inlineTemplate" | "inlineTemplateStart" | "standalone"
  > = {};

  if (argument === undefined || !ts.isObjectLiteralExpression(argument)) {
    diagnostics.push(createAngularDiagnostic("angular-component-metadata-dynamic", "info"));
    return result;
  }

  for (const property of argument.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      diagnostics.push(createAngularDiagnostic("angular-component-metadata-dynamic", "info"));
      continue;
    }

    const name = ts.isIdentifier(property.name)
      ? property.name.text
      : ts.isStringLiteral(property.name)
        ? property.name.text
        : undefined;
    if (name === undefined) {
      continue;
    }

    if (name === "selector") {
      const value = ts.isPropertyAssignment(property) ? readStaticString(property.initializer) : undefined;
      if (value === undefined) {
        diagnostics.push(createAngularDiagnostic("angular-component-selector-dynamic", "info"));
      } else {
        result.selector = value;
        const elementSelector = elementSelectorFromComponentSelector(value);
        if (elementSelector) {
          result.elementSelector = elementSelector;
        } else {
          diagnostics.push(createAngularDiagnostic("angular-component-selector-unsupported", "info"));
        }
      }
      continue;
    }

    if (name === "templateUrl") {
      const value = ts.isPropertyAssignment(property) ? readStaticString(property.initializer) : undefined;
      if (value === undefined) {
        diagnostics.push(createAngularDiagnostic("angular-template-url-dynamic", "info"));
      } else {
        result.templateUrl = value;
        result.templateKind = "external";
      }
      continue;
    }

    if (name === "template") {
      const initializer = ts.isPropertyAssignment(property) ? property.initializer : undefined;
      const value = readStaticString(initializer);
      if (value === undefined || initializer === undefined) {
        diagnostics.push(createAngularDiagnostic("angular-template-dynamic", "info"));
      } else {
        result.inlineTemplate = value;
        result.templateKind = "inline";
        result.inlineTemplateStart = initializer.getStart() + 1;
        if (ts.isNoSubstitutionTemplateLiteral(initializer)) {
          // content starts after opening backtick
        } else if (ts.isStringLiteral(initializer)) {
          result.inlineTemplateStart = initializer.getStart() + 1;
        }
      }
      continue;
    }

    if (name === "standalone") {
      const value = ts.isPropertyAssignment(property) ? readStaticBoolean(property.initializer) : undefined;
      if (value !== undefined) {
        result.standalone = value;
      }
    }
  }

  return result;
}

export function parseComponentMetadataFromSource(
  sourceFile: ts.SourceFile,
  uri: string,
): ParsedComponentMetadata[] {
  const components: ParsedComponentMetadata[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node)) {
      const className = node.name?.text;
      const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
      for (const decorator of decorators) {
        if (!ts.isCallExpression(decorator.expression)) {
          continue;
        }
        const expression = decorator.expression.expression;
        if (!ts.isIdentifier(expression) || expression.text !== "Component") {
          continue;
        }

        const diagnostics: AngularSourceDiagnostic[] = [];
        const metadata = analyzeComponentArgument(decorator.expression.arguments[0], diagnostics);
        const parsed: ParsedComponentMetadata = {
          ...metadata,
          className,
          diagnostics,
        };

        if (!metadata.templateKind) {
          diagnostics.push(createAngularDiagnostic("angular-template-missing", "info", uri, className));
        }

        components.push(parsed);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return components;
}

export function parseTypeScriptSource(source: string, uri: string): ts.SourceFile {
  return ts.createSourceFile(uri, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
