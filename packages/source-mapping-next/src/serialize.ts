import type { NextRouteCatalog } from "@a11yst/types";
import { omitUndefinedDeep } from "./diagnostics.js";

export function stableSerializeNextCatalog(catalog: NextRouteCatalog): string {
  return JSON.stringify(omitUndefinedDeep(catalog));
}
