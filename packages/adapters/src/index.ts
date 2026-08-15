/**
 * Framework adapters for a11yst route discovery, dev-server hints, and readiness.
 */

export type {
  AdapterContext,
  DevServerRecommendation,
  FrameworkAdapter,
  ReadinessStrategy,
  ResolveAdapterInput,
  ResolveProjectRoutesInput,
  ResolveProjectRoutesResult,
  RouteSamplesConfig,
} from "./types.js";

export type {
  DiscoveredRoute,
  RouteDiscoveryMode,
  RouteDiscoveryResult,
  RouteOrigin,
  SkippedRoutePattern,
} from "@a11yst/types";

export {
  resolveAdapter,
  recommendDevServer,
  listAdapters,
  isGenericWebFramework,
  FIRST_CLASS_ADAPTERS,
} from "./registry.js";

export { htmlAdapter } from "./html.js";
export { reactAdapter } from "./react.js";
export { nextAdapter } from "./next.js";
export { angularAdapter, readAngularJson, resolveAngularSourceRoot } from "./angular.js";
export { vueAdapter } from "./vue.js";
export { nuxtAdapter } from "./nuxt.js";
export { genericWebAdapter, bindGenericWebAdapter, GENERIC_WEB_FRAMEWORKS } from "./generic-web.js";

export { resolveProjectRoutes } from "./routes/merge.js";
export { emptyDiscovery, fallbackRootRoute, createAdapterContext, readPackageJson } from "./shared.js";
export { discoverHtmlRoutes, htmlRelativePathToRoute } from "./routes/html-discovery.js";
export {
  discoverNextRoutesFromPaths,
  mergeAppAndPagesRoutes,
  appRouterRelativePathToRoute,
  pagesRouterRelativePathToRoute,
  isAppRouterPageFile,
  isPagesRouterPageFile,
  parseNextSegment,
} from "./routes/next-discovery.js";
export {
  discoverNuxtRoutesFromPaths,
  nuxtRelativePathToRoute,
  isNuxtPageFile,
} from "./routes/nuxt-discovery.js";
export { applyDynamicSamples } from "./routes/dynamic-samples.js";
export { discoverReactRoutes } from "./routes/react-discovery.js";

export {
  resolveReadiness,
  genericBodyReadiness,
  reactReadiness,
  nextReadiness,
  angularReadiness,
  vueReadiness,
  nuxtReadiness,
  htmlReadiness,
} from "./readiness/resolve.js";

export { walkFiles, ADAPTER_IGNORED_DIRECTORY_NAMES } from "./utils/fs-walk.js";
export { generateRouteId, humanizeRouteId, makeDiscoveredRoute } from "./utils/routes.js";
export { recommendDevServerFromScripts } from "./utils/dev-server.js";
