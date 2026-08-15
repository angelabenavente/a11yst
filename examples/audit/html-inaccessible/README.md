# audit/html-inaccessible

A minimal static HTML page with three **documented, intentional**
accessibility violations, used to verify that a11yst's Phase 4 browser audit
engine (Playwright + axe-core) detects real problems and records them in its
JSON/evidence/report bundle.

## Documented violations

Each violation is marked in `index.html` with an `<!-- AXE VIOLATION (...) -->`
comment directly above the offending markup:

| axe-core rule ID | Element                                    |
| ----------------- | ------------------------------------------- |
| `image-alt`       | `<img>` logo with no `alt` attribute        |
| `button-name`     | Icon-only `<button>` with no accessible name |
| `label`           | `<input type="email">` with no `<label>`    |

Tests against this example should assert that these **rule IDs are present**
in the audit results, not an exact total violation count (axe-core rule sets
can evolve between versions).

## What's here

- `index.html` — page with the violations above; everything else (document
  language, title, heading structure, working nav) is left valid so the
  signal stays isolated.
- `logo.svg` — tiny inline vector logo referenced (without `alt`) by the
  `<img>` tag.
- `serve.mjs` — zero-dependency static file server (`node:http` + `node:fs`).

## Run it

```bash
pnpm --filter @a11yst/example-audit-html-inaccessible start
```

Serves on `http://127.0.0.1:4178` (override with `PORT`).

## a11yst config

See `a11yst.config.ts`:

- 1 route (`/`)
- 1 profile (`default`)
- 1 desktop viewport (1440×900)
- `devServer` launches `node serve.mjs` and reuses an already-running server

Expected planned runs: `1 × 1 × 1 = 1`.
