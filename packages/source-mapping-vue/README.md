# @a11yst/source-mapping-vue [![NPM version](https://img.shields.io/npm/v/@a11yst/source-mapping-vue.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-mapping-vue) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/source-mapping-vue.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-mapping-vue)

Conservative static source catalog and mapping for Vue 3 Single-File Components.

## Scope

- Parses `.vue` files listed in `@a11yst/source-index` only
- Analyzes `<template>` blocks with `@vue/compiler-sfc` and `@vue/compiler-dom`
- Does not execute script, script setup, or styles
- Does not resolve imports or component definitions
- Does not integrate with audit or reports in 10f

## Matching

- Native DOM selectors apply to HTML tags only
- Component usages are cataloged by source name (PascalCase / kebab-case aliases)
- Unique selector → `high` / `selector-match` (never `exact`)
- Existing source location → `exact`
- Multiple candidates → `ambiguous`

## Limitations

- Pug and external templates are not supported
- Render functions, Vue JSX/TSX, and Vue 2 are out of scope
- Dynamic bindings and spreads reduce or block attribute matching
- No runtime Vue execution
