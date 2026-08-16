# Continuous integration

a11yst can run accessibility audits in CI with deterministic exit codes and multiple report formats from a single audit.

> a11yst does not certify WCAG conformance. CI reports surface accessibility findings and policy breaches; they are not compliance certificates.

## Prerequisites

- **Node.js** `>= 20` (this repository uses `.nvmrc` with `20`)
- **pnpm** via Corepack, matching `packageManager` in `package.json` (`pnpm@9.15.0` in this monorepo)
- **Playwright Chromium** installed in the CI image or during the job
- A configured **`a11yst.config.ts`** with projects, routes, and optionally a dev server
- A versioned **`.a11yst/baseline.json`** when using baseline-aware CI policy

Chromium installation is separate from package installation:

```bash
pnpm exec playwright install chromium
```

In Debian-based CI runners, use `--with-deps` to install system libraries:

```bash
pnpm exec playwright install --with-deps chromium
```

## Installation

`@a11yst/cli` is **not published** to a public registry yet.

Until a public release is available, run a11yst from a repository checkout (`pnpm build` then `pnpm a11yst`) or from locally packed tarballs validated by the release consumer-install suite. Registry install commands are not currently executable.

## Baseline in Git

Commit **`.a11yst/baseline.json`** to record known accessibility debt and enable comparison in CI.

Keep **`.a11yst/results/`** out of version control unless you deliberately archive audit bundles:

```gitignore
.a11yst/results/
```

> A baseline records known accessibility debt. It does not make that debt accessible or compliant.

Do **not** invent or refresh baselines automatically as an undocumented CI side effect.

## Recommended CI policy

```typescript
import { defineConfig } from "@a11yst/config";

export default defineConfig({
  ci: {
    failOnNew: true,
    failOnRegression: true,
    failOnExpiredClassification: true,
    minimumSeverity: "high",
  },
  reports: {
    sarif: true,
    junit: true,
    markdown: true,
  },
  projects: [
    /* your web project */
  ],
});
```

CLI flags override config for that run:

```bash
pnpm a11yst audit \
  --fail-on-new \
  --fail-on-regression \
  --fail-on-expired-classification \
  --minimum-severity high \
  --sarif \
  --junit
```

Setting `--minimum-severity` alone does not enable the policy; at least one fail-on flag must be enabled. Enabled CI policy requires baseline comparison.

## Exit codes

| Exit code | Meaning |
| --- | --- |
| `0` | Audit completed; CI policy disabled or passed |
| `1` | Operational/configuration error, or policy not evaluated |
| `2` | Audit completed; configured CI policy failed |

**Exit `2` is not a crash.** It means the audit finished and the configured policy detected breaches at or above `--minimum-severity`.

**Exit `1` must not be converted to `2`.** Operational failures and "policy not evaluated" (for example, baseline missing when required) are exit `1`.

A policy failure does not prevent report generation. Each report format is derived from the same audit result; formats do not re-evaluate policy independently.

## Artifacts

From a checkout, a typical job can:

1. Install dependencies and Chromium.
2. Run `pnpm a11yst audit --json` (redirect stdout if you need a file).
3. Collect `.a11yst/results/` plus optional `--sarif-output` / `--junit-output` / `--markdown-output` copies.
4. Fail the job on exit `1` or `2` after artifacts are uploaded.

Regenerate formats without a browser:

```bash
pnpm a11yst report --format sarif
```

## Report formats in CI

- **HTML** — human report in the audit bundle. May contain screenshots and DOM snippets.
- **SARIF 2.1.0** — optional (`--sarif`). Accessibility findings are not security vulnerabilities.
- **JUnit XML** — optional (`--junit`) for test-result dashboards.
- **Markdown** — default human summary (`reports/a11yst.md`).

See [Reports](./reports.md) and [Severity model](./severity-model.md).

## Next steps

- [Getting Started](./getting-started.md) — local checkout and first audit
- [Baselines & governance](./baselines-and-governance.md) — lifecycle and classifications
- [Configuration](./configuration.md) — `ci` and `reports` options
