# a11yst Shop demo

End-to-end demo of a11yst on a small fictional HTML store. The scenario shows routes, profiles, viewports, an interactive flow checkpoint, baseline comparison, source mapping, recommendations, CI policy, and multiple report formats—all through the real CLI and audit engine.

> This demo intentionally contains accessibility barriers so a11yst has something to detect. It is not an example of accessible HTML.

## What this demonstrates

- **Routes** — `/account` in the baseline stage; `/account` and `/checkout` in the current stage
- **Profiles** — `default` and `keyboard`
- **Viewports** — mobile and desktop
- **Flow/checkpoint** — opens the checkout help dialog and audits the interactive state
- **Baseline** — real baseline created from a baseline-stage audit
- **Lifecycle** — at least one **known** and one **new** finding in the current stage
- **Source mapping** — HTML findings mapped to `site/*.html` when evidence allows
- **Recommendations** — contextual guidance (not patches) for supported rules
- **Policy** — current stage can fail CI policy on new high-severity findings (exit `2`)
- **Reports** — JSON, HTML, SARIF, JUnit, Markdown, and GitHub annotation outputs

Automated testing does not establish WCAG conformance and does not replace manual accessibility testing.

## Intentional accessibility barriers

| Area | Issue | Purpose |
| --- | --- | --- |
| `/account` | Informative image without `alt` | Stable baseline finding (`image-alt`) |
| `/checkout` | Icon-only help button without accessible name | New finding (`button-name`) with recommendations |
| `/checkout` | Discount field without label | New finding (`label`) |
| Help dialog (checkpoint) | Dialog without accessible name | Interactive-state finding (`aria-dialog-name`) |

a11yst found the barriers configured in this scenario—not every possible barrier on the page.

## Prerequisites

From a repository checkout:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm exec playwright install chromium
```

## Run the demo

```bash
pnpm demo full
```

See [WALKTHROUGH.md](./WALKTHROUGH.md) for a step-by-step guide. The runner prints a plain-text summary and writes `.a11yst/demo/demo-summary.md` from stored results.

Other commands:

```bash
pnpm demo baseline   # baseline-stage audit + baseline create
pnpm demo current    # current-stage audit (may exit 2 due to policy)
pnpm demo clean      # remove .a11yst artifacts
pnpm demo help
```

Direct stage control:

```bash
A11YST_DEMO_STAGE=baseline pnpm a11yst audit --cwd examples/demo/a11yst-shop --json
A11YST_DEMO_STAGE=current pnpm a11yst audit --cwd examples/demo/a11yst-shop --json
```

Default stage is **current** when `A11YST_DEMO_STAGE` is unset.

## Expected story

### Baseline stage

1. Audits `/account` only.
2. Records deliberate account image issue.
3. `pnpm demo baseline` creates `.a11yst/baseline.json` from real results.

### Current stage

1. Audits `/account` and `/checkout`.
2. Runs the checkout help flow checkpoint.
3. Account image issue remains **known**.
4. Checkout and checkpoint issues appear as **new**.
5. Source mapping points to `site/account.html` or `site/checkout.html` when evidence is sufficient.
6. Recommendations provide review guidance for supported rules.
7. CI policy may report a breach (**exit `2`**) because of new high-severity findings.

The `full` demo runner treats exit `2` from the current audit as an expected policy outcome and exits `0` after printing a summary. Running `pnpm a11yst audit` directly still returns `2` when policy fails.

## Artifacts

Generated under `examples/demo/a11yst-shop/.a11yst/` (gitignored):

- `results/runs/<auditId>/results.json`
- `results/runs/<auditId>/report/index.html`
- SARIF, JUnit, Markdown, and GitHub annotation files when enabled
- `baseline.json` after baseline creation
- `demo/demo-summary.md` after `pnpm demo full` or `pnpm demo current`

## Stage mechanism

`A11YST_DEMO_STAGE` controls routes, flows, and CI policy:

| Value | Routes | Flow | CI policy |
| --- | --- | --- | --- |
| `baseline` | `/account` | none | disabled |
| `current` | `/account`, `/checkout` | checkout help | enabled |

Invalid values cause configuration loading to fail with a clear error.
