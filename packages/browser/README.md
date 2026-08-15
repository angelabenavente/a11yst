# @a11yst/browser

Playwright + axe-core web audit engine for a11yst. Launches Chromium, navigates
to planned routes, runs `@axe-core/playwright`, and normalises violations into
a11yst `Finding`s. Also manages an optional local dev server for the duration
of a web audit.

Only Chromium is supported in this phase. Before running audits, install the
Chromium browser binary once per machine/CI image:

```bash
pnpm exec playwright install chromium
```

This package intentionally has no dependency on Commander or any CLI output
formatting — it is consumed by `@a11yst/cli` (or any other caller) as a plain
async function.

## Usage

```ts
import { runWebAudit } from "@a11yst/browser";

const result = await runWebAudit({
  project,
  runs,
  configDir,
  options: { headed: false, navigationTimeoutMs: 30_000 },
});
```

See `src/index.ts` for the full exported surface.
