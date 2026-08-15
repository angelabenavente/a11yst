import type { RecommendationResult } from "@a11yst/types";
import { omitUndefinedDeep } from "./sanitize.js";

export function stableSerializeRecommendationResult(result: RecommendationResult): string {
  return `${JSON.stringify(omitUndefinedDeep(result))}\n`;
}
