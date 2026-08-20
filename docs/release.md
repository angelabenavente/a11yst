# Release process

Internal maintainer checklist for a11yst releases. This document does **not** authorize publishing by itself.

## Decisions required before first public release

| Decision | Status |
| --- | --- |
| License (SPDX + `LICENSE` file) | **confirmed: MPL-2.0** |
| Public repository URL and package metadata | **decision required** |
| Security reporting channel | **decision required** |
| npm publish access for `@a11yst/*` | **decision required** |
| First public release version number | **decision required** |
| Contributor IP policy documentation | **prepared** |
| Active external CLA | **no** |
| External pull requests | **welcome** |
| External code merge | **blocked until CLA activation (P3c)** |

Do not invent these values in manifests or documentation.

External pull requests may be opened and reviewed, but external code cannot be merged until contributor agreement legal review and CLA workflow activation (P3c). This does not block the first public release while external merges remain disabled.

Before accepting the first external code contribution: legal review of the final contributor agreement is required.

## Versioning

a11yst uses [Semantic Versioning](https://semver.org/) as a format.

- All 27 publishable runtime packages currently share version `1.0.0`.
- Stable releases follow semantic-versioning compatibility expectations.
- Publish internal packages in dependency order, with `@a11yst/cli` last.
- Release tooling derives topological order from workspace runtime dependencies; do not maintain a hand-written list of 27 package names in this document.

**First public release version:** `1.0.0`. Do not tag or publish until the release gate is complete.

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

`ci:quality` runs build, typecheck, lint, and all unit tests. `ci:release` audits the published packages' production dependency paths, verifies release and documentation contracts, packs the publishable closure, and installs it in a clean consumer project. The two release integration tests run sequentially. Example applications are not shipped and their dependency paths are reported separately from the publication gate.

Optional before a major release: broader integration and demo suites when behavior outside packaging/docs changed.

## Automated gates

- [`.github/workflows/quality.yml`](../.github/workflows/quality.yml) runs the repository quality gate and targeted integration tests on pull requests and pushes to `main`.
- [`.github/workflows/release-gate.yml`](../.github/workflows/release-gate.yml) runs the complete quality, production dependency audit, packaging, and consumer-install gates for `v*` tags or manual dispatch.
- Both workflows use the pinned Node and pnpm versions from repository metadata, frozen lockfile installation, read-only repository permissions, and an explicit Playwright Chromium installation.
- The release gate validates a release candidate; it never publishes packages.

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

## Publish preparation

Publication commands are intentionally omitted until license, repository metadata, package access, security contact, and first public version are finalized.

Do not run `npm publish`, `pnpm publish`, or equivalent from this checklist until Phase 13j completes the release gate.

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
- [ ] Security reporting channel confirmed
- [ ] Contributor IP policy documented (active CLA not required for initial release while external merges remain closed)
- [ ] Full test matrix green
- [ ] Packaging integration green
- [ ] Consumer install integration green
- [ ] Security docs ready
- [ ] No focused or unexpected skipped tests
- [ ] Release tarballs inspected

Automated accessibility testing does not establish WCAG conformance and does not replace manual accessibility testing.
