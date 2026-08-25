# @a11yst/source-mapping-next [![NPM version](https://img.shields.io/npm/v/@a11yst/source-mapping-next.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-mapping-next) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/source-mapping-next.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-mapping-next)

Conservative static Next.js route catalog and source mapping for a11yst Phase 10e.

## Scope

This package consumes `@a11yst/source-index` and `@a11yst/source-mapping-react` to:

- Detect App Router roots (`app/`, `src/app/`) and Pages Router roots (`pages/`, `src/pages/`)
- Build a static route catalog from indexed filenames only
- Narrow React catalog files by matched route, router, scope, and optional hints
- Delegate element matching to `mapReactSource()`
- Enrich candidates with Next.js metadata

Supported:

- Static, dynamic, catch-all, and optional catch-all route patterns
- App Router route groups, layouts, templates, and state files in the catalog
- Pages Router `_app`, `_document`, `_error`, and special error pages
- Client/server module boundary hints for App Router files
- Conservative ambiguity when multiple files or routers match

Not supported in 10e:

- Reading `.next` build output or manifests
- Executing Next.js or evaluating runtime navigation
- Rewrites, redirects, middleware, basePath, or i18n routing
- Custom `pageExtensions` from `next.config.*`
- Route handlers and API routes as UI sources
- Intercepting routes in automatic matching
- Parallel routes without an explicit slot hint
- Import resolution, source maps, ranking, recommendations, or audit integration

Phase 10f adds Vue/Nuxt. Phase 10h adds ranking. Phase 10i adds recommendations.

## Route narrowing

Route evidence reduces the React search space. It never creates a candidate by itself and never upgrades confidence to `exact`.

Unique selector matches inside the narrowed file set keep React confidence rules (`high` for unique selectors, never `exact` except existing source locations).

When the same selector appears in both a layout and a page, the result is `ambiguous` with no selected candidate.

## Security

The catalog and mapping never store source code, AST nodes, concrete route parameter values, query strings, hash fragments, absolute paths, or secrets.

## Public API

- `createNextRouteCatalog()`
- `mapNextSource()`
- `normalizeNextRoutePath()`
- `resolveRoutesForPath()`
- `stableSerializeNextCatalog()`
