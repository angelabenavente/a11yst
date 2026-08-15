# audit/html-accessible

A minimal, intentionally **accessible** static HTML page used to verify that
a11yst's Phase 4 browser audit engine reports (close to) zero violations and
produces its JSON/evidence/report bundle for a clean page.

## What's here

- `index.html` — single page with a `lang="en"` document, a heading, a
  labelled navigation landmark, a button with visible text, an `<img>` with
  meaningful `alt` text, and a form input with a properly associated
  `<label for>`.
- `logo.svg` — tiny inline vector logo referenced by the `<img>` tag.
- `serve.mjs` — zero-dependency static file server (`node:http` + `node:fs`).

## Run it

```bash
pnpm --filter @a11yst/example-audit-html-accessible start
```

Serves on `http://127.0.0.1:4177` (override with `PORT`).

## a11yst config

See `a11yst.config.ts`:

- 1 route (`/`)
- 1 profile (`default`)
- 1 desktop viewport (1440×900)
- `devServer` launches `node serve.mjs` and reuses an already-running server

Expected planned runs: `1 × 1 × 1 = 1`.

## Expected audit result

No intentional accessibility violations. This example is the "control" for
`audit/html-inaccessible`.
