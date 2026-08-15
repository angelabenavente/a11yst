export type {
  AccessibilityRecommendation,
  AccessibilityRecommendationInput,
  RecommendationAction,
  RecommendationApplicability,
  RecommendationDiagnostic,
  RecommendationExample,
  RecommendationKind,
  RecommendationResult,
  RecommendationStatus,
  RecommendationTarget,
  RecommendationTargetStatus,
  RecommendationVerification,
} from "@a11yst/types";

export { createAccessibilityRecommendations, resolveRecommendationTarget } from "./generate.js";
export { getRecommendationRegistry, lookupRecipe, listRecipeRuleIds } from "./registry.js";
export { stableSerializeRecommendationResult } from "./serialize.js";
export { normalizeFramework, exampleLanguageForFramework } from "./framework.js";
export { RECIPE_DEFINITIONS } from "./recipes.js";
