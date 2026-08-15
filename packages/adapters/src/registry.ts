import type { Platform, WebFramework } from "@a11yst/types";
import type {
  AdapterContext,
  DevServerRecommendation,
  FrameworkAdapter,
  ResolveAdapterInput,
} from "./types.js";
import { htmlAdapter } from "./html.js";
import { reactAdapter } from "./react.js";
import { nextAdapter } from "./next.js";
import { angularAdapter } from "./angular.js";
import { vueAdapter } from "./vue.js";
import { nuxtAdapter } from "./nuxt.js";
import { bindGenericWebAdapter, genericWebAdapter } from "./generic-web.js";
import { GENERIC_WEB_FRAMEWORKS } from "./shared.js";

const FIRST_CLASS_ADAPTERS: readonly FrameworkAdapter[] = [
  htmlAdapter,
  reactAdapter,
  nextAdapter,
  angularAdapter,
  vueAdapter,
  nuxtAdapter,
];

/**
 * Resolve the adapter for a detected framework.
 * Meta-frameworks (next, nuxt) have dedicated adapters — they are not
 * resolved via their underlying library adapters.
 */
export function resolveAdapter(input: ResolveAdapterInput): FrameworkAdapter | null {
  switch (input.framework) {
    case "html":
      return htmlAdapter;
    case "react":
      return reactAdapter;
    case "next":
      return nextAdapter;
    case "angular":
      return angularAdapter;
    case "vue":
      return vueAdapter;
    case "nuxt":
      return nuxtAdapter;
    default:
      if (GENERIC_WEB_FRAMEWORKS.includes(input.framework)) {
        return bindGenericWebAdapter(input.framework);
      }
      return bindGenericWebAdapter("unknown");
  }
}

/** List canonical adapters deterministically (unique ids, sorted). */
export function listAdapters(): FrameworkAdapter[] {
  return [...FIRST_CLASS_ADAPTERS, genericWebAdapter].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}

export function isGenericWebFramework(framework: WebFramework): boolean {
  return GENERIC_WEB_FRAMEWORKS.includes(framework);
}

/** Recommend dev-server metadata via the resolved framework adapter. */
export function recommendDevServer(
  framework: WebFramework,
  context: AdapterContext,
): DevServerRecommendation {
  const adapter = resolveAdapter({ framework, platform: "web" });
  if (!adapter) {
    return { hint: "Dev server recommendations are not available for this project." };
  }
  return adapter.recommendDevServer(context);
}

export { FIRST_CLASS_ADAPTERS };

export type { Platform, WebFramework };
