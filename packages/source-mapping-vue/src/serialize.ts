import type { VueSourceCatalog } from "@a11yst/types";

export function stableSerializeVueCatalog(catalog: VueSourceCatalog): string {
  return JSON.stringify(catalog);
}
