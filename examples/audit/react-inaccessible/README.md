# audit/react-inaccessible

A minimal React + Vite app with two client-side routes, used to verify that
a11yst's Phase 4 browser audit engine can audit a real SPA (not just static
HTML), persist evidence/report artifacts, and correctly handle a profile
(`keyboard`) that isn't implemented yet.

## Routes

- `/` — accessible: heading, descriptive text, and a button with a real
  accessible name.
- `/broken` — **documented, intentional violation**: an icon-only button
  with no accessible name (`<!-- AXE VIOLATION (button-name) -->` in
  `src/pages/BrokenPage.tsx`).

| axe-core rule ID | Where                          |
| ----------------- | ------------------------------ |
| `button-name`     | Icon-only button on `/broken`  |

## Develop

```bash
pnpm --filter @a11yst/example-audit-react-inaccessible dev
```

Serves on `http://127.0.0.1:5177` (fixed in both `vite.config.ts` and
`a11yst.config.ts`).

## a11yst config

`a11yst.config.ts` schedules:

- 2 routes (`/`, `/broken`)
- 2 profiles: `default`, `keyboard`
- 1 desktop viewport
- `devServer` launches `pnpm dev` and reuses an already-running server

Expected planned runs: `2 × 2 × 1 = 4`.

The `keyboard` profile is intentionally included even though a11yst does not
implement keyboard-flow auditing yet (see root `README.md`)—runs for this
profile are expected to be reported as **skipped**, not passed or failed.
