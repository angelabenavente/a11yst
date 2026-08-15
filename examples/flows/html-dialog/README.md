# flows/html-dialog

Static HTML fixture for a11yst Phase 7 user flows and dialog focus rules.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Index linking to both dialog scenarios |
| `/accessible` | Dialog moves focus in on open and returns to trigger on close |
| `/bad` | Dialog opens without moving focus (stays on trigger) |

## Flows

| Flow id | Checkpoints | Expected findings |
| --- | --- | --- |
| `dialog-accessible` | `dialog-open`, `dialog-closed` | None (control) |
| `dialog-bad` | `dialog-open`, `dialog-closed` | `dialog-focus-entry` on open; optional `dialog-focus-return-review` on close |

## Run

```bash
pnpm --filter @a11yst/example-flows-html-dialog start
```

Serves on `http://127.0.0.1:6311` (override with `PORT`).

## a11yst config

- 3 routes, 2 profiles (`default`, `keyboard`), 1 desktop viewport
- 2 flows with explicit checkpoints
- Route planned runs: `3 × 2 × 1 = 6`
- Flow checkpoint runs: `(2 + 2) × 2 × 1 = 8`

Audit flows only:

```bash
pnpm a11yst audit --cwd examples/flows/html-dialog --flows-only
```
