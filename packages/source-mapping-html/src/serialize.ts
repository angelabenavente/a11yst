import type { HtmlSourceCatalog } from "@a11yst/types";
import { omitUndefinedDeep } from "./diagnostics.js";

export function stableSerializeHtmlCatalog(catalog: HtmlSourceCatalog): string {
  return JSON.stringify(omitUndefinedDeep(catalog));
}
