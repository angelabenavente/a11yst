import type { RecommendationRecipe } from "./recipes.js";
import { RECIPE_DEFINITIONS } from "./recipes.js";

export type RecommendationRegistry = {
  byRuleId: ReadonlyMap<string, RecommendationRecipe>;
  byAlias: ReadonlyMap<string, string>;
};

function buildRegistry(definitions: RecommendationRecipe[]): RecommendationRegistry {
  const byRuleId = new Map<string, RecommendationRecipe>();
  const byAlias = new Map<string, string>();

  for (const recipe of definitions) {
    if (byRuleId.has(recipe.ruleId)) {
      throw new Error(`Duplicate recommendation recipe: ${recipe.ruleId}`);
    }
    byRuleId.set(recipe.ruleId, recipe);

    for (const alias of recipe.aliases ?? []) {
      const normalized = alias.toLowerCase();
      if (byAlias.has(normalized) || byRuleId.has(normalized)) {
        throw new Error(`Recommendation alias conflict: ${normalized}`);
      }
      byAlias.set(normalized, recipe.ruleId);
    }
  }

  return { byRuleId, byAlias };
}

let cachedRegistry: RecommendationRegistry | undefined;

export function getRecommendationRegistry(): RecommendationRegistry {
  if (!cachedRegistry) {
    cachedRegistry = buildRegistry(RECIPE_DEFINITIONS);
  }
  return cachedRegistry;
}

export function lookupRecipe(ruleId: string): RecommendationRecipe | undefined {
  const registry = getRecommendationRegistry();
  const normalized = ruleId.toLowerCase();
  const direct = registry.byRuleId.get(normalized);
  if (direct) {
    return direct;
  }
  const alias = registry.byAlias.get(normalized);
  if (!alias) {
    return undefined;
  }
  return registry.byRuleId.get(alias);
}

export function listRecipeRuleIds(): string[] {
  return [...getRecommendationRegistry().byRuleId.keys()].sort((left, right) => left.localeCompare(right));
}
