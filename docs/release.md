# Release process

Internal maintainer checklist for a11yst releases.

## First public release decisions

| Decision | Status |
| --- | --- |
| License (SPDX + `LICENSE` file) | **confirmed: MPL-2.0** |
| Public repository URL and package metadata | **confirmed: `angelabenavente/a11yst`** |
| Security reporting channel | **confirmed: GitHub private vulnerability reporting** |
| npm publish access for `@a11yst/*` | **confirmed: public** |
| First public release version number | **confirmed: 1.0.0** |
| Contributor IP policy documentation | **prepared** |
| Active external CLA | **no** |
| External pull requests | **welcome** |
| External code merge | **blocked until CLA activation (P3c)** |

External pull requests may be opened and reviewed, but external code cannot be merged until contributor agreement legal review and CLA workflow activation (P3c). This does not block the first public release while external merges remain disabled.

Before accepting the first external code contribution: legal review of the final contributor agreement is required.

## Versioning

a11yst uses [Semantic Versioning](https://semver.org/) as a format.

- All 27 publishable runtime packages currently share version `1.0.1`.
- Stable releases follow semantic-versioning compatibility expectations.
- Publish internal packages in dependency order, with `@a11yst/cli` last.
- Release tooling derives topological order from workspace runtime dependencies; do not maintain a hand-written list of 27 package names in this document.

**First public release version:** confirmed 1.0.0. Do not tag or publish until the release gate is complete.

## Preconditions

- Clean working tree on the intended release commit.
- Node.js >= 22.12 and pnpm 9.15.0 available.
- License recorded in root `LICENSE` and all publishable package manifests (`MPL-2.0`).
- Repository metadata confirmed for all publishable packages.
- `publishConfig.access` confirmed for scoped packages when publishing publicly.
- First public version confirmed.
- Security reporting channel confirmed.

## Verification matrix

From repository root:

```bash
pnpm ci:quality
pnpm exec playwright install chromium
pnpm ci:release
```

`ci:quality` runs build, typecheck, lint, and all unit tests. `ci:release` audits production dependency paths of the publishable packages.

Optional before a major release: broader integration and demo suites when behavior outside packaging/docs changed.

## Packaging

- Build all packages before `pnpm pack`.
- Pack the full 27-package runtime closure into a temporary directory.
- Inspect tarballs: `dist`-only allowlists (plus `@a11yst/cli` README when included), no `workspace:*` in packed manifests, no committed `.tgz` files.
- See [package-distribution.md](./package-distribution.md).

## Consumer install validation

External consumer validation installs only `@a11yst/cli` and resolves the closure from local tarballs. It is **not** a public installation guide.

Temporary `pnpm.overrides` used in tests simulate a registry locally and must not be copied into public Getting Started instructions.

## Browser requirement

Browser-based audits require Playwright Chromium installed explicitly after package installation:

```bash
pnpm exec playwright install chromium
```

a11yst does not run this during package install. Missing-browser failures must remain actionable and must not be confused with CI policy breaches.

## Publish

Authenticate with an npm account that can publish the `@a11yst` scope, then verify the identity:

```bash
npm login
npm whoami
```

After the verification matrix is green and the intended release changes are committed, inspect the publish without changing the registry:

```bash
pnpm -r --filter './packages/*' publish --dry-run --publish-branch main
```

Publish all packages in topological dependency order. The manifests set public access explicitly:

```bash
pnpm -r --filter './packages/*' publish --publish-branch main
```

Do not publish only `@a11yst/cli`: registry consumers need the complete 27-package runtime closure at the same version.

## Post-release (future)

After a real public release:

- Verify install in a fresh consumer project from the registry.
- Verify `a11yst --help`, a real audit, and `report-from-results`.
- Update `CHANGELOG.md` with the released version and date.
- Update public installation docs only after the package is actually published.

## Release checklist

- [ ] License confirmed
- [ ] Repository metadata confirmed
- [ ] Publish access confirmed
- [ ] First public version confirmed
- [x] Security reporting channel confirmed (GitHub private vulnerability reporting)
- [ ] Contributor IP policy documented (active CLA not required for initial release while external merges remain closed)
- [ ] Full test matrix green
- [ ] Packaging integration green
- [ ] Consumer install integration green
- [ ] Security docs ready
- [ ] No focused or unexpected skipped tests
- [ ] Release tarballs inspected

Automated accessibility testing does not establish WCAG conformance and does not replace manual accessibility testing.
