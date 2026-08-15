import type { NuxtRouteCatalog } from "@a11yst/types";

export function stableSerializeNuxtCatalog(catalog: NuxtRouteCatalog): string {
  return JSON.stringify(catalog);
}
