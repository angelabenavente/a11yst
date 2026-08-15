import type {
  AngularSourceCatalog,
  HtmlSourceCatalog,
  NextRouteCatalog,
  NuxtRouteCatalog,
  ReactSourceCatalog,
  SourceIndexResult,
  VueSourceCatalog,
} from "@a11yst/types";
import { createAngularSourceCatalog } from "@a11yst/source-mapping-angular";
import { createHtmlSourceCatalog } from "@a11yst/source-mapping-html";
import { createNextRouteCatalog } from "@a11yst/source-mapping-next";
import { createNuxtRouteCatalog } from "@a11yst/source-mapping-nuxt";
import { createReactSourceCatalog } from "@a11yst/source-mapping-react";
import { createVueSourceCatalog } from "@a11yst/source-mapping-vue";
import type { NormalizedFramework } from "./framework.js";
import { createSourceAnalysisDiagnostic } from "./diagnostics.js";

export type CatalogBundle = {
  html?: HtmlSourceCatalog;
  react?: ReactSourceCatalog;
  next?: NextRouteCatalog;
  vue?: VueSourceCatalog;
  nuxt?: NuxtRouteCatalog;
  angular?: AngularSourceCatalog;
};

export type CatalogBuildResult = {
  catalogs: CatalogBundle;
  diagnostics: ReturnType<typeof createSourceAnalysisDiagnostic>[];
  partial: boolean;
};

function catalogKey(framework: NormalizedFramework, scopeIds: string[]): string {
  return `${framework}:${[...scopeIds].sort().join(",")}`;
}

export class CatalogCache {
  private readonly repositoryRoot: string;
  private readonly sourceIndex: SourceIndexResult;
  private readonly html = new Map<string, Promise<HtmlSourceCatalog>>();
  private readonly react = new Map<string, Promise<ReactSourceCatalog>>();
  private readonly next = new Map<string, Promise<NextRouteCatalog>>();
  private readonly vue = new Map<string, Promise<VueSourceCatalog>>();
  private readonly nuxt = new Map<string, Promise<NuxtRouteCatalog>>();
  private readonly angular = new Map<string, Promise<AngularSourceCatalog>>();

  constructor(repositoryRoot: string, sourceIndex: SourceIndexResult) {
    this.repositoryRoot = repositoryRoot;
    this.sourceIndex = sourceIndex;
  }

  getHtml(scopeIds: string[]): Promise<HtmlSourceCatalog> {
    const key = catalogKey("html", scopeIds);
    if (!this.html.has(key)) {
      this.html.set(
        key,
        createHtmlSourceCatalog({
          repositoryRoot: this.repositoryRoot,
          sourceIndex: this.sourceIndex,
          scopeIds,
        }),
      );
    }
    return this.html.get(key)!;
  }

  getReact(scopeIds: string[]): Promise<ReactSourceCatalog> {
    const key = catalogKey("react", scopeIds);
    if (!this.react.has(key)) {
      this.react.set(
        key,
        createReactSourceCatalog({
          repositoryRoot: this.repositoryRoot,
          sourceIndex: this.sourceIndex,
          scopeIds,
        }),
      );
    }
    return this.react.get(key)!;
  }

  async getNext(scopeIds: string[]): Promise<{ react: ReactSourceCatalog; next: NextRouteCatalog }> {
    const react = await this.getReact(scopeIds);
    const key = catalogKey("next", scopeIds);
    if (!this.next.has(key)) {
      this.next.set(
        key,
        Promise.resolve(
          createNextRouteCatalog({
            sourceIndex: this.sourceIndex,
            reactCatalog: react,
            scopeIds,
          }),
        ),
      );
    }
    return { react, next: await this.next.get(key)! };
  }

  getVue(scopeIds: string[]): Promise<VueSourceCatalog> {
    const key = catalogKey("vue", scopeIds);
    if (!this.vue.has(key)) {
      this.vue.set(
        key,
        createVueSourceCatalog({
          repositoryRoot: this.repositoryRoot,
          sourceIndex: this.sourceIndex,
          scopeIds,
        }),
      );
    }
    return this.vue.get(key)!;
  }

  async getNuxt(scopeIds: string[]): Promise<{ vue: VueSourceCatalog; nuxt: NuxtRouteCatalog }> {
    const vue = await this.getVue(scopeIds);
    const key = catalogKey("nuxt", scopeIds);
    if (!this.nuxt.has(key)) {
      this.nuxt.set(
        key,
        Promise.resolve(
          createNuxtRouteCatalog({
            sourceIndex: this.sourceIndex,
            vueCatalog: vue,
            scopeIds,
          }),
        ),
      );
    }
    return { vue, nuxt: await this.nuxt.get(key)! };
  }

  getAngular(scopeIds: string[]): Promise<AngularSourceCatalog> {
    const key = catalogKey("angular", scopeIds);
    if (!this.angular.has(key)) {
      this.angular.set(
        key,
        createAngularSourceCatalog({
          repositoryRoot: this.repositoryRoot,
          sourceIndex: this.sourceIndex,
          scopeIds,
        }),
      );
    }
    return this.angular.get(key)!;
  }
}

export async function buildRequiredCatalogs(
  cache: CatalogCache,
  frameworks: Set<NormalizedFramework>,
  scopeIds: string[],
): Promise<CatalogBuildResult> {
  const diagnostics: ReturnType<typeof createSourceAnalysisDiagnostic>[] = [];
  let partial = false;
  const catalogs: CatalogBundle = {};

  if (frameworks.has("html")) {
    catalogs.html = await cache.getHtml(scopeIds);
    if (catalogs.html.status === "partial") {
      partial = true;
    }
  }
  if (frameworks.has("react")) {
    catalogs.react = await cache.getReact(scopeIds);
    if (catalogs.react.status === "partial") {
      partial = true;
    }
  }
  if (frameworks.has("next")) {
    const nextBundle = await cache.getNext(scopeIds);
    catalogs.react = nextBundle.react;
    catalogs.next = nextBundle.next;
    if (catalogs.next.status === "partial" || nextBundle.react.status === "partial") {
      partial = true;
    }
  }
  if (frameworks.has("vue")) {
    catalogs.vue = await cache.getVue(scopeIds);
    if (catalogs.vue.status === "partial") {
      partial = true;
    }
  }
  if (frameworks.has("nuxt")) {
    const nuxtBundle = await cache.getNuxt(scopeIds);
    catalogs.vue = nuxtBundle.vue;
    catalogs.nuxt = nuxtBundle.nuxt;
    if (catalogs.nuxt.status === "partial" || nuxtBundle.vue.status === "partial") {
      partial = true;
    }
  }
  if (frameworks.has("angular")) {
    catalogs.angular = await cache.getAngular(scopeIds);
    if (catalogs.angular.status === "partial") {
      partial = true;
    }
  }

  if (partial) {
    diagnostics.push(
      createSourceAnalysisDiagnostic(
        "source-analysis-catalog-partial",
        "warning",
        "One or more source catalogs completed with partial status",
      ),
    );
  }

  return { catalogs, diagnostics, partial };
}
