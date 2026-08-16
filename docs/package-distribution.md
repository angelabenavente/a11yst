# Package distribution

Internal release documentation for a11yst workspace packaging. This document describes the current local tarball strategy only. It is not a public installation guide.

## Consumer entry package

- Package: `@a11yst/cli`
- Version: `0.1.0` (provisional)
- Bin: `a11yst` → `./dist/bin.js`

A consumer should install `@a11yst/cli` to obtain the `a11yst` command. Runtime behavior depends on the full publishable workspace closure below, not on the CLI package alone.

## Publishable package closure

a11yst currently distributes as a multi-package workspace. The CLI runtime closure contains every `@a11yst/*` package under `packages/` except the monorepo root.

| Package | Version | Role | Runtime dependency of | Private | Pack status |
| --- | ---: | --- | --- | --- | --- |
| `@a11yst/types` | 0.1.0 | Shared contracts | all packages | no | pack OK |
| `@a11yst/adapters` | 0.1.0 | Framework adapters | CLI, core, browser | no | pack OK |
| `@a11yst/artifacts` | 0.1.0 | Artifact writing | CLI, core | no | pack OK |
| `@a11yst/baseline` | 0.1.0 | Baseline comparison | CLI, core | no | pack OK |
| `@a11yst/rules` | 0.1.0 | Rule definitions | browser, profiles | no | pack OK |
| `@a11yst/flows` | 0.1.0 | Flow execution | CLI, core, browser, config | no | pack OK |
| `@a11yst/profiles` | 0.1.0 | Profile execution | CLI, browser | no | pack OK |
| `@a11yst/policy` | 0.1.0 | CI policy evaluation | CLI, core | no | pack OK |
| `@a11yst/junit` | 0.1.0 | JUnit generation | CLI, core | no | pack OK |
| `@a11yst/sarif` | 0.1.0 | SARIF generation | CLI, core, reporters | no | pack OK |
| `@a11yst/detect` | 0.1.0 | Project detection | CLI | no | pack OK |
| `@a11yst/config` | 0.1.0 | Config loading/validation | CLI | no | pack OK |
| `@a11yst/source-mapping` | 0.1.0 | Mapping domain model | source stack | no | pack OK |
| `@a11yst/source-ranking` | 0.1.0 | Candidate ranking | recommendations, source-analysis | no | pack OK |
| `@a11yst/recommendations` | 0.1.0 | Recommendation engine | source-analysis | no | pack OK |
| `@a11yst/source-index` | 0.1.0 | Source indexing | source-analysis, mappers | no | pack OK |
| `@a11yst/source-mapping-html` | 0.1.0 | HTML mapper | source-analysis, react/vue/angular | no | pack OK |
| `@a11yst/source-mapping-react` | 0.1.0 | React mapper | source-analysis, next | no | pack OK |
| `@a11yst/source-mapping-next` | 0.1.0 | Next.js mapper | source-analysis | no | pack OK |
| `@a11yst/source-mapping-vue` | 0.1.0 | Vue mapper | source-analysis, nuxt | no | pack OK |
| `@a11yst/source-mapping-nuxt` | 0.1.0 | Nuxt mapper | source-analysis | no | pack OK |
| `@a11yst/source-mapping-angular` | 0.1.0 | Angular mapper | source-analysis | no | pack OK |
| `@a11yst/source-analysis` | 0.1.0 | Source analysis orchestrator | core | no | pack OK |
| `@a11yst/reporters` | 0.1.0 | Report generation | CLI, core | no | pack OK |
| `@a11yst/browser` | 0.1.0 | Playwright audit engine | core | no | pack OK |
| `@a11yst/core` | 0.1.0 | Audit orchestrator | CLI | no | pack OK |
| `@a11yst/cli` | 0.1.0 | Consumer CLI entry | consumer install | no | pack OK |

Closure size: 27 packages.

## Private packages

| Package | Role |
| --- | --- |
| `a11yst-monorepo` (root) | Private workspace root, not packed |

No workspace runtime package is currently marked `private`.

## Packaging rules

1. Run `pnpm build` before `pnpm pack`.
2. Generate tarballs only in temporary directories during 13g verification.
3. Do not publish to npm in 13g.
4. Keep the dependency graph unchanged unless a real packaging defect requires a manifest fix.
5. Do not commit generated `.tgz` files.
6. Each publishable package uses `"files": ["dist", "LICENSE"]` (CLI adds README, NOTICE, TRADEMARKS).
7. `pnpm pack` rewrites `workspace:*` dependencies to the local package version (`0.1.0`).

## Pack procedure

From repository root after a successful build:

```bash
pnpm build
pnpm vitest run tests/unit/release
pnpm vitest run tests/integration/release/package-tarballs.test.ts
```

Manual spot-check:

```bash
PACK_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/a11yst-pack.XXXXXX")"
pnpm --dir packages/cli pack --pack-destination "$PACK_ROOT"
tar -tzf "$PACK_ROOT"/*.tgz | head
tar -xOf "$PACK_ROOT"/*.tgz package/package.json
rm -rf "$PACK_ROOT"
```

## Consumer installation

Consumer installation from local tarballs is intentionally deferred to Phase 13h.

Static checks in 13g verify:

- publishable runtime closure;
- manifest entrypoints;
- tarball allowlists;
- workspace protocol rewrite inside packed manifests.

The definitive undeclared-dependency test remains the external consumer install in 13h.

## Remaining release blockers

### Blocks public publish

- `release-repository-metadata-missing` — no repository/homepage/bugs metadata on publishable packages.
- `publish-access-not-configured` — scoped packages have no `publishConfig.access`.
- `first-public-version-undecided` — first public release version not confirmed.
- `security-contact-decision-required` — no confirmed private vulnerability reporting channel.

### Resolved in Phase 13h

- External consumer install validated from local tarballs.
- Playwright Chromium install command validated from consumer environment (`pnpm exec playwright install chromium`).
- Dev-server cleanup on browser launch failure.

### Resolved in Phase 13i

- `version-strategy-provisional` — documented in [release.md](./release.md).
- Formal `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and release checklist.
- `@a11yst/cli` package README, LICENSE, NOTICE, and TRADEMARKS included in tarball.

### Does not block Phase 13j gate prep

- Missing repository/homepage metadata (blocker documented; not invented).
- Missing `publishConfig.access` (blocker documented; not applied without decision).

### Important follow-ups for 13j

- Confirm repository URL, publish access, security contact, and first public version.
- Execute full release gate verification before any publish attempt.

## Public metadata state (Phase 13i)

| Field | Publishable packages (27) | Notes |
| --- | --- | --- |
| `license` | MPL-2.0 | Confirmed for all publishable packages |
| `repository` | not set | Blocker until owner decision |
| `homepage` | not set | Pending |
| `bugs` | not set | Pending |
| `publishConfig.access` | not set | Blocker until owner decision |
| `description` | present | Technical descriptions only |
| `keywords` | `@a11yst/cli` only | Optional discoverability |
| `files` | `dist` + `LICENSE` (+ CLI README, NOTICE, TRADEMARKS) | Each tarball includes license text |

## Version strategy

Documented in [release.md](./release.md):

- Semantic Versioning format.
- Synchronized `0.x` versions across the 27-package closure during pre-release.
- Internal packages publish in dependency order; `@a11yst/cli` last.
- First public release version: **decision pending** (current manifest version `0.1.0` is provisional).

## CLI package README

- Location: `packages/cli/README.md`
- Included in `@a11yst/cli` tarball.
- Self-contained: Node >= 20, browser requirement, not-yet-published install wording, accessibility caveat.
- Does not link to monorepo-only relative docs paths.

## Consumer install validation

Phase 13h validates a real external consumer project installed only from local tarballs generated by `pnpm pack`.

### Test strategy

1. Build the monorepo.
2. Pack all 27 publishable runtime packages into a temp `packs/` directory.
3. Copy `tests/fixtures/release/consumer-app/` into a temp consumer project outside the repository.
4. Install only `@a11yst/cli` as a direct dependency.
5. Supply the remaining 26 internal packages through temporary `pnpm.overrides` pointing at `file:../packs/*.tgz`.
6. Block accidental registry resolution with consumer-local `.npmrc`:

```ini
@a11yst:registry=http://127.0.0.1:9/
```

7. Run the installed CLI (`pnpm exec a11yst` / `node_modules/.bin/a11yst`) for help, init, detect, doctor, audit, and report-from-results.
8. Remove `node_modules` and reinstall with `--frozen-lockfile`.

This is a local registry simulation only. It is not a public installation guide.

### Consumer package

- Direct dependency: `@a11yst/cli@0.1.0` (resolved through temporary `pnpm.overrides` to `file:../packs/a11yst-cli-0.1.0.tgz`)
- Internal packages: resolved through temporary `pnpm.overrides` for the full runtime closure
- Fixture app: `tests/fixtures/release/consumer-app/`

### Browser requirement

Consumer validation confirms:

- Playwright resolves from the installed dependency graph.
- `pnpm exec playwright --version` works from the consumer project when Playwright is reachable through the installed graph.
- Chromium must be installed separately for real audits (`pnpm exec playwright install chromium`).

a11yst does not download Chromium during package install.

### Current public release blockers

- `release-repository-metadata-missing`
- `publish-access-not-configured`
- `first-public-version-undecided`
- `security-contact-decision-required`

Consumer install validation can pass while public publish blockers remain.

Automated accessibility testing does not establish WCAG conformance and does not replace manual accessibility testing.
