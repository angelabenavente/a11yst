# Package distribution

Internal release documentation for the a11yst workspace package set.

## Consumer entry package

- Package: `@a11yst/cli`
- Version: `1.0.2`
- Bin: `a11yst` → `./dist/bin.js`

A consumer should install `@a11yst/cli` to obtain the `a11yst` command. Runtime behavior depends on the full publishable workspace closure below, not on the CLI package alone.

## Publishable package closure

a11yst currently distributes as a multi-package workspace. The CLI runtime closure contains every `@a11yst/*` package under `packages/` except the monorepo root.

| Package | Version | Role | Runtime dependency of | Private | Pack status |
| --- | ---: | --- | --- | --- | --- |
| `@a11yst/types` | 1.0.2 | Shared contracts | all packages | no | pack OK |
| `@a11yst/adapters` | 1.0.2 | Framework adapters | CLI, core, browser | no | pack OK |
| `@a11yst/artifacts` | 1.0.2 | Artifact writing | CLI, core | no | pack OK |
| `@a11yst/baseline` | 1.0.2 | Baseline comparison | CLI, core | no | pack OK |
| `@a11yst/rules` | 1.0.2 | Rule definitions | browser, profiles | no | pack OK |
| `@a11yst/flows` | 1.0.2 | Flow execution | CLI, core, browser, config | no | pack OK |
| `@a11yst/profiles` | 1.0.2 | Profile execution | CLI, browser | no | pack OK |
| `@a11yst/policy` | 1.0.2 | CI policy evaluation | CLI, core | no | pack OK |
| `@a11yst/junit` | 1.0.2 | JUnit generation | CLI, core | no | pack OK |
| `@a11yst/sarif` | 1.0.2 | SARIF generation | CLI, core, reporters | no | pack OK |
| `@a11yst/detect` | 1.0.2 | Project detection | CLI | no | pack OK |
| `@a11yst/config` | 1.0.2 | Config loading/validation | CLI | no | pack OK |
| `@a11yst/source-mapping` | 1.0.2 | Mapping domain model | source stack | no | pack OK |
| `@a11yst/source-ranking` | 1.0.2 | Candidate ranking | recommendations, source-analysis | no | pack OK |
| `@a11yst/recommendations` | 1.0.2 | Recommendation engine | source-analysis | no | pack OK |
| `@a11yst/source-index` | 1.0.2 | Source indexing | source-analysis, mappers | no | pack OK |
| `@a11yst/source-mapping-html` | 1.0.2 | HTML mapper | source-analysis, react/vue/angular | no | pack OK |
| `@a11yst/source-mapping-react` | 1.0.2 | React mapper | source-analysis, next | no | pack OK |
| `@a11yst/source-mapping-next` | 1.0.2 | Next.js mapper | source-analysis | no | pack OK |
| `@a11yst/source-mapping-vue` | 1.0.2 | Vue mapper | source-analysis, nuxt | no | pack OK |
| `@a11yst/source-mapping-nuxt` | 1.0.2 | Nuxt mapper | source-analysis | no | pack OK |
| `@a11yst/source-mapping-angular` | 1.0.2 | Angular mapper | source-analysis | no | pack OK |
| `@a11yst/source-analysis` | 1.0.2 | Source analysis orchestrator | core | no | pack OK |
| `@a11yst/reporters` | 1.0.2 | Report generation | CLI, core | no | pack OK |
| `@a11yst/browser` | 1.0.2 | Playwright audit engine | core | no | pack OK |
| `@a11yst/core` | 1.0.2 | Audit orchestrator | CLI | no | pack OK |
| `@a11yst/cli` | 1.0.2 | Consumer CLI entry | consumer install | no | pack OK |

Closure size: 27 packages.

## Private packages

| Package | Role |
| --- | --- |
| `a11yst-monorepo` (root) | Private workspace root, not packed |

No workspace runtime package is currently marked `private`.

## Packaging rules

1. Run `pnpm build` before `pnpm pack`.
2. Generate verification tarballs only in temporary directories.
3. Publish only after the full release gate passes.
4. Keep the dependency graph unchanged unless a real packaging defect requires a manifest fix.
5. Do not commit generated `.tgz` files.
6. Each publishable package uses `"files": ["dist", "LICENSE"]` (CLI adds README, NOTICE, TRADEMARKS).
7. `pnpm pack` rewrites `workspace:*` dependencies to the local package version (`1.0.2`).

## Pack procedure

From repository root after a successful build:

```bash
pnpm build
```

Manual spot-check:

```bash
PACK_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/a11yst-pack.XXXXXX")"
pnpm --dir packages/cli pack --pack-destination "$PACK_ROOT"
tar -tzf "$PACK_ROOT"/*.tgz | head
tar -xOf "$PACK_ROOT"/*.tgz package/package.json
rm -rf "$PACK_ROOT"
```

## Release decisions

- Repository metadata points to `angelabenavente/a11yst`.
- Every scoped package sets `publishConfig.access` to `public`.
- The first public release version is `1.0.0`.
- Security reporting uses GitHub private vulnerability reporting, documented in `SECURITY.md`.

### Resolved in Phase 13h

- External consumer install validated from local tarballs.
- Playwright Chromium install command validated from consumer environment (`pnpm exec playwright install chromium`).
- Dev-server cleanup on browser launch failure.

### Resolved in Phase 13i

- `version-strategy-provisional` — documented in [release.md](./release.md).
- Formal `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and release checklist.
- `@a11yst/cli` package README, LICENSE, NOTICE, and TRADEMARKS included in tarball.

### Before publishing

- Execute the full release gate verification.
- Authenticate to npm and confirm publish permission for the `@a11yst` scope.

## Public metadata state (Phase 13i)

| Field | Publishable packages (27) | Notes |
| --- | --- | --- |
| `license` | MPL-2.0 | Confirmed for all publishable packages |
| `repository` | `git+https://github.com/angelabenavente/a11yst.git` | Confirmed |
| `homepage` | `https://www.a11yst.dev` | Confirmed |
| `bugs` | `https://github.com/angelabenavente/a11yst/issues` | Confirmed |
| `publishConfig.access` | `public` | Confirmed |
| `description` | present | Technical descriptions only |
| `keywords` | `@a11yst/cli` only | Optional discoverability |
| `files` | `dist` + `LICENSE` (+ CLI README, NOTICE, TRADEMARKS) | Each tarball includes license text |

## Version strategy

Documented in [release.md](./release.md):

- Semantic Versioning format.
- Synchronized versions across the 27-package closure.
- Internal packages publish in dependency order; `@a11yst/cli` last.
- First public release version: `1.0.0`.

## CLI package README

- Location: `packages/cli/README.md`
- Included in `@a11yst/cli` tarball.
- Self-contained: Node >= 22.12, browser requirement, installation command, accessibility caveat.
- Does not link to monorepo-only relative docs paths.

## Consumer installation

Install `@a11yst/cli` from the registry. The remaining `@a11yst/*` runtime packages resolve as transitive dependencies. The CLI also depends on Playwright and exposes the `playwright` binary so `pnpm exec playwright` works in consumer projects.

Browser-based audits still require a separate Chromium install:

```bash
pnpm exec playwright install chromium
```

Automated accessibility testing does not establish WCAG conformance and does not replace manual accessibility testing.
