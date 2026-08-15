import type {
  AccessibilityRecommendation,
  AccessibilityRecommendationInput,
  RecommendationAction,
  RecommendationDiagnostic,
  RecommendationExample,
  RecommendationResult,
  RecommendationStatus,
  RecommendationVerification,
} from "@a11yst/types";
import {
  MAX_ACTIONS,
  MAX_CAVEATS,
  MAX_COMBINED_EXAMPLE_LENGTH,
  MAX_EXAMPLES,
  MAX_VERIFICATION,
  REQUIRED_CAVEATS,
} from "./constants.js";
import { createRecommendationDiagnostic, sortRecommendationDiagnostics } from "./diagnostics.js";
import { normalizeFramework } from "./framework.js";
import { lookupRecipe } from "./registry.js";
import type { RecipeContext } from "./recipes.js";
import { sanitizeInput, sanitizeRuleId } from "./sanitize.js";
import { resolveRecommendationTarget } from "./target.js";

function compareActions(left: RecommendationAction, right: RecommendationAction): number {
  return left.id.localeCompare(right.id);
}

function compareVerification(left: RecommendationVerification, right: RecommendationVerification): number {
  const modeOrder = left.mode.localeCompare(right.mode);
  if (modeOrder !== 0) {
    return modeOrder;
  }
  return left.id.localeCompare(right.id);
}

function compareExamples(left: RecommendationExample, right: RecommendationExample): number {
  const languageOrder = left.language.localeCompare(right.language);
  if (languageOrder !== 0) {
    return languageOrder;
  }
  const titleOrder = left.title.localeCompare(right.title);
  if (titleOrder !== 0) {
    return titleOrder;
  }
  return left.code.localeCompare(right.code);
}

function limitExamples(examples: RecommendationExample[], diagnostics: RecommendationDiagnostic[]): RecommendationExample[] {
  const sorted = [...examples].sort(compareExamples).slice(0, MAX_EXAMPLES);
  const combined = sorted.reduce((total, example) => total + example.code.length, 0);
  if (examples.length > MAX_EXAMPLES) {
    diagnostics.push(createRecommendationDiagnostic("recommendation-example-limit-reached", "info", "Example limit was reached"));
  }
  if (combined > MAX_COMBINED_EXAMPLE_LENGTH) {
    diagnostics.push(createRecommendationDiagnostic("recommendation-example-limit-reached", "info", "Combined example length was truncated"));
    let remaining = MAX_COMBINED_EXAMPLE_LENGTH;
    return sorted.map((example) => {
      const code = example.code.slice(0, remaining);
      remaining -= code.length;
      return { ...example, code };
    });
  }
  return sorted;
}

function unsupportedRecommendation(input: AccessibilityRecommendationInput): AccessibilityRecommendation {
  return {
    id: `${input.ruleId}.unsupported`,
    ruleId: input.ruleId,
    status: "unsupported",
    applicability: "low",
    title: "Review this accessibility issue manually",
    summary: "No specific automated recipe is available for this rule.",
    rationale: "Manual review is required when a deterministic recipe is unavailable.",
    target: resolveRecommendationTarget(input).target,
    actions: ([
      { id: "unsupported.review-help", kind: "manual-test", title: "Review guidance", description: "Review available help information and reproduce the issue." },
      { id: "unsupported.inspect-element", kind: "manual-test", title: "Inspect the element", description: "Inspect the element and surrounding context in the rendered application." },
    ] satisfies RecommendationAction[]).sort(compareActions),
    verification: ([
      { id: "unsupported.rerun-audit", title: "Rerun automated audit", description: "Run the audit again after changes.", mode: "automated" },
      { id: "unsupported.manual", title: "Perform manual verification", description: "Verify behavior with appropriate manual testing.", mode: "manual" },
    ] satisfies RecommendationVerification[]).sort(compareVerification),
    examples: [],
    caveats: [...REQUIRED_CAVEATS].sort((left, right) => left.localeCompare(right)),
    documentationUrl: input.helpUrl,
  };
}

export function createAccessibilityRecommendations(input: AccessibilityRecommendationInput): RecommendationResult {
  const diagnostics: RecommendationDiagnostic[] = [];
  const originalRuleId = input.ruleId;

  if (!sanitizeRuleId(originalRuleId)) {
    return {
      version: 1,
      status: "invalid",
      recommendations: [],
      diagnostics: sortRecommendationDiagnostics([
        createRecommendationDiagnostic("invalid-rule-id", "error", "Rule ID is invalid", originalRuleId),
      ]),
    };
  }

  const sanitized = sanitizeInput(input);
  const working = sanitized.input;
  if (sanitized.truncated) {
    diagnostics.push(createRecommendationDiagnostic("recommendation-input-truncated", "info", "Recommendation input was truncated", working.ruleId));
  }
  if (sanitized.sensitive) {
    diagnostics.push(createRecommendationDiagnostic("recommendation-sensitive-value-redacted", "warning", "Sensitive recommendation input was redacted", working.ruleId));
  }
  if (working.helpUrl === undefined && input.helpUrl) {
    diagnostics.push(createRecommendationDiagnostic("invalid-help-url", "warning", "Help URL was rejected", working.ruleId));
  }

  const { target, diagnostics: targetDiagnostics } = resolveRecommendationTarget(working);
  diagnostics.push(...targetDiagnostics);

  if (target.status === "invalid") {
    return {
      version: 1,
      status: "invalid",
      recommendations: [],
      diagnostics: sortRecommendationDiagnostics(diagnostics),
    };
  }

  const recipe = lookupRecipe(working.ruleId);
  if (!recipe) {
    diagnostics.push(createRecommendationDiagnostic("unsupported-rule", "info", "No recipe is registered for this rule", working.ruleId));
    const recommendation = unsupportedRecommendation(working);
    return {
      version: 1,
      status: "unsupported",
      recommendations: [recommendation],
      diagnostics: sortRecommendationDiagnostics(diagnostics),
    };
  }

  const framework = normalizeFramework(working.context?.framework);
  const context: RecipeContext = {
    framework,
    target,
    elementTag: working.element?.tagName,
    iconOnly: !working.element?.visibleText && (working.element?.tagName === "button" || working.element?.role === "button"),
  };

  let status: RecommendationStatus = recipe.manualReview ? "manual-review" : "recommended";
  if (target.status === "ambiguous" && diagnostics.some((entry) => entry.code === "recommendation-target-conflict")) {
    status = "manual-review";
    diagnostics.push(createRecommendationDiagnostic("recommendation-requires-manual-review", "info", "Manual review is required due to target conflict", working.ruleId));
  }

  const actions = recipe.buildActions(context).sort(compareActions).slice(0, MAX_ACTIONS);
  if (actions.length < recipe.buildActions(context).length) {
    diagnostics.push(createRecommendationDiagnostic("recommendation-action-limit-reached", "info", "Action limit was reached", working.ruleId));
  }

  const verification = recipe.buildVerification(context).sort(compareVerification).slice(0, MAX_VERIFICATION);
  const examples = limitExamples(recipe.buildExamples(context), diagnostics);
  const caveats = [...new Set([...recipe.buildCaveats(context), ...REQUIRED_CAVEATS])]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, MAX_CAVEATS);

  const recommendation: AccessibilityRecommendation = {
    id: `${working.ruleId}.primary`,
    ruleId: working.ruleId,
    status,
    applicability: recipe.defaultApplicability,
    title: recipe.title,
    summary: recipe.summary,
    rationale: recipe.rationale,
    target,
    actions,
    verification,
    examples,
    caveats,
  };

  if (working.helpUrl) {
    recommendation.documentationUrl = working.helpUrl;
  }

  return {
    version: 1,
    status,
    recommendations: [recommendation],
    diagnostics: sortRecommendationDiagnostics(diagnostics),
  };
}

export { resolveRecommendationTarget };
