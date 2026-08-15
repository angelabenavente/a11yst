# @a11yst/source-mapping-angular

Conservative static source catalog and mapping for Angular components and templates.

## Scope

- Reads indexed `typescript` and `angular-template` files from `@a11yst/source-index`
- Detects `@Component` metadata via TypeScript compiler API (no decorator execution)
- Parses templates with `@angular/compiler` (no Angular runtime)
- Supports external `templateUrl` and inline `template` string literals
- Does not resolve imports, NgModules, standalone imports, or Angular Router

## Matching

- DOM selectors apply to native HTML elements only
- Component usages are cataloged at the call site, not the child definition
- Unique selector → `high` / `selector-match` (never `exact`)
- Existing source location → `exact`
- Multiple candidates → `ambiguous`

## Limitations

- Static decorator metadata only (no spreads, variables, or aliases)
- Simple element selectors only for component metadata
- Property bindings are treated as dynamic
- No audit or report integration in 10g
