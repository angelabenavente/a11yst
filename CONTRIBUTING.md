# Contributing to a11yst

Thank you for helping improve a11yst. This document describes the real development workflow in this repository.

## Prerequisites

- Node.js **>= 22.12**
- pnpm **9.15.0** (`packageManager` in root `package.json`)
- Playwright Chromium for browser-based tests:

```bash
pnpm exec playwright install chromium
```

Chromium is managed separately by Playwright. a11yst does **not** download browsers during package installation.

## Setup

Clone your working copy of the repository, then from the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm exec playwright install chromium
```

## Development commands

Use the scripts that exist in this repository:

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
```

There is no `pnpm test:all` or `pnpm check` script.

During day-to-day work, run the smallest relevant suite. Before merging release-sensitive changes, run the release and regression matrix described in [docs/release.md](./docs/release.md).

## Testing guidance

| Layer | Command | Notes |
| --- | --- | --- |
| Unit | `pnpm test:unit` | Fast; no browser |
| Integration | `pnpm test:integration` | Includes browser audits; slower |
| Release packaging | `pnpm vitest run tests/integration/release/package-tarballs.test.ts` | Real `pnpm pack` |
| Consumer install | `pnpm vitest run tests/integration/release/consumer-install.test.ts` | External temp consumer; real Chromium |

Run release integration tests **sequentially**, not in parallel.

Do not commit focused tests (`.only`) or unexpected skipped tests.

## Contribution principles

- Keep changes targeted and add regression tests for behavior changes.
- Use realistic fixtures; avoid synthetic pages designed only to pass one rule.
- Do not claim WCAG compliance, certification, total coverage, or automatic fixes.
- Avoid leaking repository roots, home directories, secrets, or full source dumps in user-facing output.
- Clean up browser and dev-server child processes in integration tests.
- Prefer `spawn`/`execFile` with argument arrays over shell string concatenation.

## Security expectations for contributors

- Do not place real secrets in fixtures. Use clearly fake markers such as `A11YST_CONSUMER_SECRET_*`.
- Do not serialize secrets, home paths, or repository roots into audit results or reports unless required for a vetted diagnostic.
- Treat missing-browser and policy-breach failures as distinct operational outcomes.

## Accessibility claims

a11yst includes tests designed to reduce accidental disclosure and improve deterministic behavior, but tests are not a security or accessibility guarantee.

Automated accessibility checks do not establish WCAG conformance and do not replace manual testing.

## Release-sensitive changes

Changes to package manifests, packaging allowlists, consumer install behavior, or CLI distribution require the release verification matrix in [docs/release.md](./docs/release.md).

## Code of conduct

No project code of conduct is published yet. Treat contributors and reporters with respect.

## Ways to contribute

- **Report bugs** — open an issue with reproduction steps when possible.
- **Suggest features** — describe the problem and proposed outcome; proposals do not require a CLA.
- **Improve documentation** — documentation pull requests are welcome.
- **Submit pull requests** — code and documentation changes may be proposed via pull request.
- **Contribute code** — code pull requests are welcome; see CLA and merge gates below.

Issues, bug reports, and feature proposals do **not** require a CLA and do not constitute CLA acceptance.

## Pull requests

External pull requests are **welcome**. Before submitting:

- keep changes focused;
- add or update tests when behavior changes;
- run relevant checks (`pnpm build`, `pnpm typecheck`, `pnpm lint`, and targeted tests);
- follow existing style and conventions in the repository.

Until the project's CLA workflow is activated, external code pull requests may be reviewed and discussed but **cannot be merged**.

Opening a pull request does **not** sign or activate any CLA.

See [docs/contributing-ip.md](./docs/contributing-ip.md) and [docs/contribution-governance.md](./docs/contribution-governance.md) for the contribution model and governance rules.

## Contributor License Agreement

a11yst Community is licensed under MPL-2.0. Contributors retain applicable copyright in their contributions.

The project intends to use a contributor license agreement (CLA) for external code contributions. Draft agreements are prepared but **not yet legally active**:

- [docs/legal/CLA-DRAFT.md](./docs/legal/CLA-DRAFT.md)
- [docs/legal/CCLA-DRAFT.md](./docs/legal/CCLA-DRAFT.md)

- Pull requests may be opened now.
- The CLA signing workflow is not yet active.
- Until activation, external code pull requests cannot be merged.
- After activation, a CLA check will be required before merge.
- CLA approval is separate from technical review, tests, and maintainer approval.

Opening a pull request does **not** constitute CLA acceptance or signature. No contributor license agreement is active yet.

Contributors will **not** be required to assign copyright as the project's default contribution model. The final contributor agreement will define the precise license granted to the project and remains subject to legal review.

In practice, code and copyright-significant documentation contributions should be treated as CLA-gated once the workflow is active. The final CLA workflow will define which external contributions require agreement coverage.

Bot contribution handling (for example Dependabot or Renovate) will be finalized during CLA activation.

Contributions merged into Community are distributed under MPL-2.0 unless a file clearly states another compatible licensing arrangement. See [LICENSE](./LICENSE) and [docs/licensing.md](./docs/licensing.md).

When the CLA workflow is active, contributors must have the right to submit their work and must follow the active contributor process.

Do not submit legal names, addresses, employer declarations, government IDs, private email addresses, or other sensitive personal information to this repository as part of CLA signing. The future signing workflow will handle agreement records outside git.

## Merge requirements

A passing CLA check (once active) removes only the legal contribution gate for external code. It does **not** replace:

- code review;
- CI and tests;
- security and quality review;
- licensing and provenance checks;
- maintainer approval.

Signing a CLA does **not** guarantee merge approval.

## Third-party and confidential material

Do not submit copied proprietary code, third-party source without license/provenance identification, or confidential information you are not authorized to disclose.

Contributors remain responsible for having the right to submit all material, including AI-assisted material.

If a change adds a dependency, identify the package, license, runtime/dev classification, and reason in the pull request.

## Security reports

See [SECURITY.md](./SECURITY.md).
