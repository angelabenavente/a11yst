import type { AngularSourceCatalog } from "@a11yst/types";

export function stableSerializeAngularCatalog(catalog: AngularSourceCatalog): string {
  return JSON.stringify(catalog);
}
