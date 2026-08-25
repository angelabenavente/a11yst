# @a11yst/source-mapping-html [![NPM version](https://img.shields.io/npm/v/@a11yst/source-mapping-html.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-mapping-html) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/source-mapping-html.svg?style=flat)](https://www.npmjs.com/package/@a11yst/source-mapping-html)

Conservative HTML static source catalog and mapping for a11yst Phase **10c**.

This package maps accessibility evidence from static HTML files to repository-relative
source locations. It does **not** execute scripts, open a browser, or integrate with
audit or reports.

## Scope

Supported:

- Files indexed as `kind: html` (`.html`, `.htm`)
- Static DOM declared in HTML source
- Selector, ID, attribute, route, and static text hints
- Existing validated `sourceLocation` → `exact` via `@a11yst/source-mapping`

Not supported in 10c:

- Angular templates (`*.component.html`) — Phase 10g
- JSX/React/Next/Vue/Svelte/Astro — Phases 10d–10f
- JavaScript-generated DOM
- Full Accessible Name and Description Computation
- Advanced ranking (Phase 10h) or recommendations (Phase 10i)

## Dependencies

1. `@a11yst/source-index` provides the safe file list — this package never walks the repo.
2. `parse5` parses HTML with start-tag source locations.
3. `css-what` parses CSS selectors for conservative matching.
4. `@a11yst/source-mapping` performs final candidate selection.

## Catalog

`createHtmlSourceCatalog()` reads indexed HTML files only, builds `HtmlSourceElement`
entries with:

- start-tag `SourceRegion`
- allowlisted attributes
- `staticVisibleText` (not guaranteed visible text)
- `staticAccessibleName` (static hints only, not ACCNAME)

Script/style/template/noscript content is excluded from text extraction and never stored.

## Mapping

`mapHtmlSource()` converts `HtmlSourceMappingEvidence` into `SourceMappingResult`:

| Evidence | Typical outcome |
| --- | --- |
| Valid existing source location | `mapped`, `exact` |
| Unique selector | `mapped`, `high`, `selector-match` |
| Unique ID | `mapped`, `high`, `static-source-index` |
| Attribute / text hints | `medium` or `high`, never `exact` |
| Multiple distinct matches | `ambiguous` |
| No match | `unmapped` |

Route values only narrow candidate files; they never produce `exact` confidence.

## Security

- Repository root is explicit and never serialized
- Symlinks are not followed when reading HTML
- Secrets, form values, full HTML, scripts, and styles are not stored
- Diagnostics omit absolute paths and hostile selector/text payloads

## Limits

Defaults:

```typescript
{
  maxFiles: 5_000,
  maxElementsPerFile: 50_000,
  maxTextLength: 256,
}
```

Root `.gitignore` nested files are **not** interpreted here (handled by `@a11yst/source-index` root policy only).

## Next steps

- **10d**: JSX/React mapping
- **10h**: advanced ranking
- **10i**: recommendations
- **10j**: report integration
