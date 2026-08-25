# @a11yst/source-index [![NPM version](https://img.shields.io/npm/v/@a11yst/source-index.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-index) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/source-index.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-index)

Safe, deterministic repository source file discovery for a11yst.

Phase **10b** builds a filesystem index only. It does **not** read source file
contents, parse code, or produce source mappings.

## Separation from `@a11yst/source-mapping`

| Package | Responsibility |
| --- | --- |
| `@a11yst/source-mapping` | Pure domain model: locations, confidence, candidates, results |
| `@a11yst/source-index` | Filesystem boundary: traversal, ignores, limits, classification |

## Repository root

`indexRepositorySources()` always receives an explicit absolute `repositoryRoot`.
It never uses `process.cwd()`, `process.env`, or implicit roots.

The canonical root may be resolved internally with `realpath`, but absolute paths
never appear in serialized results or diagnostics.

## Scopes

Scopes are repository-relative roots inside the monorepo:

```typescript
await indexRepositorySources({
  repositoryRoot: "/abs/path/to/repo",
  scopes: [
    { id: "storefront", rootUri: "apps/storefront", projectName: "storefront", framework: "next" },
  ],
});
```

When no scopes are provided, a default `{ id: "repository", rootUri: "." }` scope
is used. Overlapping scopes deduplicate files and merge `scopeIds`, `projectNames`,
and `frameworks`.

## Indexed file kinds

Supported kinds (by extension/name):

- `html`, `htm`
- `*.component.html` → `angular-template`
- JavaScript (`.js`, `.mjs`, `.cjs`)
- TypeScript (`.ts`, `.mts`, `.cts`)
- JSX / TSX
- Vue (`.vue`)
- Preview: Svelte (`.svelte`), Astro (`.astro`)

Generated declarations, bundles, minified files, and source maps are excluded.

## Ignored directories

Built-in excluded directory names include `node_modules`, `dist`, `.next`,
`.nuxt`, `coverage`, and `.a11yst/results` (prefix). Security excludes cannot
be overridden by user patterns.

## `.gitignore`

Only the repository root `.gitignore` is read. Missing `.gitignore` is allowed.
Unreadable `.gitignore` yields `partial` status with `gitignore-read-failed`.

**Limitation (10b):** nested `.gitignore` files are not interpreted.

## Explicit ignore patterns

`options.ignorePatterns` accepts repository-relative patterns interpreted with
the same matcher used for `.gitignore`. Absolute patterns are rejected.

## Symlinks

Symlinks are never followed. Each skipped symlink increments `symlinksSkipped`
and may emit a single `symlink-skipped` diagnostic containing only the symlink
URI — never the target path.

## Limits

Defaults:

```typescript
{
  maxFiles: 50_000,
  maxDepth: 64,
  maxFileSizeBytes: 2 * 1024 * 1024,
}
```

Reaching file or depth limits yields `partial` status. Oversized files are skipped
without failing the entire index.

## Status

| Status | Meaning |
| --- | --- |
| `complete` | All valid scopes traversed without recoverable limits/errors |
| `partial` | Permission errors, unreadable `.gitignore`, limits reached, etc. |
| `invalid` | Invalid root, unsafe scope, invalid options — indexing did not proceed |

## Determinism

Directory entries, scopes, files, scope metadata arrays, and diagnostics are
sorted deterministically. `readdir` order does not affect output.

## Privacy

Results never include absolute repository paths, source code, secrets, timestamps,
or symlink targets.

## Next steps

Phase **10c** will begin HTML/Vanilla source mapping using this index. Phase 10b
does not integrate with audit, CLI, or reports.
