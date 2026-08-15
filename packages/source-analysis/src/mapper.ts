import type { SourceMappingResult } from "@a11yst/types";
import { mapAngularSource } from "@a11yst/source-mapping-angular";
import { mapHtmlSource } from "@a11yst/source-mapping-html";
import { mapNextSource } from "@a11yst/source-mapping-next";
import { mapNuxtSource } from "@a11yst/source-mapping-nuxt";
import { mapReactSource } from "@a11yst/source-mapping-react";
import { mapVueSource } from "@a11yst/source-mapping-vue";
import type { CatalogBundle } from "./catalogs.js";
import type { NormalizedFramework } from "./framework.js";

export async function invokePrimaryMapper(
  framework: NormalizedFramework,
  catalogs: CatalogBundle,
  evidence: Record<string, unknown>,
): Promise<SourceMappingResult> {
  switch (framework) {
    case "html":
      if (!catalogs.html) {
        return { status: "unmapped", candidates: [], diagnostics: [] };
      }
      return mapHtmlSource({
        catalog: catalogs.html,
        evidence: evidence as never,
      });
    case "react":
      if (!catalogs.react) {
        return { status: "unmapped", candidates: [], diagnostics: [] };
      }
      return mapReactSource({
        catalog: catalogs.react,
        evidence: evidence as never,
      });
    case "next":
      if (!catalogs.react || !catalogs.next) {
        return { status: "unmapped", candidates: [], diagnostics: [] };
      }
      return mapNextSource({
        reactCatalog: catalogs.react,
        routeCatalog: catalogs.next,
        evidence: evidence as never,
      });
    case "vue":
      if (!catalogs.vue) {
        return { status: "unmapped", candidates: [], diagnostics: [] };
      }
      return mapVueSource({
        catalog: catalogs.vue,
        evidence: evidence as never,
      });
    case "nuxt":
      if (!catalogs.vue || !catalogs.nuxt) {
        return { status: "unmapped", candidates: [], diagnostics: [] };
      }
      return mapNuxtSource({
        vueCatalog: catalogs.vue,
        routeCatalog: catalogs.nuxt,
        evidence: evidence as never,
      });
    case "angular":
      if (!catalogs.angular) {
        return { status: "unmapped", candidates: [], diagnostics: [] };
      }
      return mapAngularSource({
        catalog: catalogs.angular,
        evidence: evidence as never,
      });
    default:
      return { status: "unmapped", candidates: [], diagnostics: [] };
  }
}
