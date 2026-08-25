# @a11yst/source-mapping-react [![NPM version](https://img.shields.io/npm/v/@a11yst/source-mapping-react.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-mapping-react) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/source-mapping-react.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-mapping-react)

Conservative static catalog and source mapping for JSX and React components in a11yst Phase 10d.

## Scope

This package reads JSX, TSX, and JavaScript files that contain parseable JSX from `@a11yst/source-index`. It parses source with `@babel/parser`, builds a static element catalog, and maps DOM evidence to JSX opening-element locations through `@a11yst/source-mapping`.

Supported:

- Intrinsic JSX elements such as `<button />` and `<input />`
- Custom component usages such as `<CheckoutButton />` and `<UI.Button />`
- Static props, class names, text, and accessible-name hints
- Conservative selector, id, attribute, component-name, owner, and text matching

Not supported in 10d:

- Next.js App Router or Pages Router semantics
- React Server Components as special semantics
- Source maps, bundles, or runtime component stacks
- Import resolution between files
- Variable evaluation, hooks, or code execution
- `React.createElement`
- Styled Components, Emotion, CSS Modules, or Tailwind resolution
- Audit, SARIF, report, or recommendation integration

Phase 10e adds Next.js routing. Phase 10h adds ranking. Phase 10i adds recommendations.

## Source index dependency

The catalog consumes indexed files only. It does not traverse the repository, use globs, or discover files outside the source index.

Accepted index kinds:

- `jsx`
- `tsx`
- `javascript` when JSX is present

Ignored kinds include `html`, `typescript`, `vue`, `svelte`, `astro`, and `angular-template`.

## Parser

Parsing uses `@babel/parser` with locations enabled. Columns are converted from Babel's 0-based columns to a11yst's 1-based contract.

- `.jsx`, `.js`, `.mjs`, `.cjs`: `jsx`
- `.tsx`: `typescript`, `jsx`

## Catalog model

Each catalog entry represents a JSX opening element:

- Intrinsic elements keep lowercase `tagName`
- Component usages keep normalized `componentName`, including member expressions such as `UI.Button`
- `ownerComponent` is the nearest statically identifiable PascalCase container
- `staticProps` stores allowlisted literal props only
- `dynamicPropNames` records unevaluated props
- `hasSpreadProps` and `spreadBeforeStaticProps` record spread uncertainty
- `staticVisibleText` and `staticAccessibleName` are conservative hints only

Fragments and `React.Fragment` are ignored because they do not represent DOM nodes.

Component usages represent JSX usage sites, not component definitions, and are not followed across files.

## Mapping behavior

`mapReactSource()` delegates final selection to `createSourceMappingResult()` from `@a11yst/source-mapping`.

Conservative rules:

- Valid `existingSourceLocation` maps to `exact` immediately
- Unique intrinsic selector match maps to `high` with `selector-match`, never `exact`
- Duplicate matches produce `ambiguous` with no selected candidate
- Unique component name alone maps to `medium`
- Component name plus stable prop can map to `high`
- `ownerComponent` filters candidates but never creates a candidate by itself
- `route` is retained as contextual signal only in 10d

The package never selects the first match, shortest path, or highest confidence when multiple distinct candidates remain.

## Security

The catalog and mapping output never store:

- Source code, AST nodes, expressions, imports, or comments
- Passwords, tokens, cookies, authorization values, or form values
- Event handlers or `dangerouslySetInnerHTML`
- Absolute paths, stack traces, or parser fragments

Filesystem access is confined to the explicit repository root. Symlinks are not followed.

## Limits

Default limits:

- `maxFiles`: 5000
- `maxElementsPerFile`: 50000
- `maxPropsPerElement`: 128
- `maxTextLength`: 256

Invalid limits produce an invalid catalog.

## Public API

- `createReactSourceCatalog()`
- `mapReactSource()`
- `stableSerializeReactCatalog()`

Diagnostics use React-specific codes such as `react-parse-failed`, `react-spread-props`, and `react-source-ambiguous`.
