import type { SourceRankingResult } from "@a11yst/types";
import { omitUndefinedDeep } from "./sanitize.js";

export function stableSerializeSourceRankingResult(result: SourceRankingResult): string {
  return JSON.stringify(omitUndefinedDeep(result));
}
