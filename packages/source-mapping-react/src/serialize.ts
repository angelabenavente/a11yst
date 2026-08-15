import type { ReactSourceCatalog } from "@a11yst/types";
import { omitUndefinedDeep } from "./diagnostics.js";

export function stableSerializeReactCatalog(catalog: ReactSourceCatalog): string {
  return JSON.stringify(omitUndefinedDeep(catalog));
}
