# Detection fixtures

This directory contains **static fixtures** for exercising `@a11yst/detect`'s
framework/platform/package-manager detection logic. They are **not** runnable
applications:

- No `node_modules`, no lockfiles resolved against a real registry, and no
  fixture in here should ever be `npm install`/`pnpm install`ed.
- Config files (`vite.config.ts`, `next.config.mjs`, `astro.config.mjs`, …)
  contain only minimal stubs (e.g. `export default {}`). They exist so the
  detector can see the *file name*, not so they can actually be executed by
  their respective tools.
- Source files are 1-2 line placeholders — just enough to give the detector
  representative file extensions (`.tsx`, `.vue`, `.svelte`, `.astro`, …).

Each subdirectory corresponds to one host framework (or platform) the
detector recognizes, plus a few special cases:

- `ambiguous/` — an intentionally confusing project with competing signals,
  used to exercise the detector's priority ordering and "close alternative"
  ambiguity diagnostics.
- `unknown-empty/` — a package with no framework signals at all, used to
  exercise the "unknown" fallback path.
- `monorepo-apps/` — a tiny pnpm-style monorepo (`apps/*` + `packages/*`)
  used to exercise workspace discovery, including a library package
  (`packages/ui`) that should be classified as "not an app" and excluded
  from results.

This directory intentionally has **no `package.json` of its own**: the root
`pnpm-workspace.yaml` matches `examples/*`, and a directory without a
`package.json` is simply skipped by pnpm's workspace resolution rather than
causing an install error. Nested fixture `package.json` files (one level or
deeper below `examples/detection/`) are not matched by that glob, so they
never become real workspace packages.

See `examples/html-basic` and `examples/react-basic` for the *real*,
installable example apps used elsewhere in this repo — those are untouched
by this fixture set.
