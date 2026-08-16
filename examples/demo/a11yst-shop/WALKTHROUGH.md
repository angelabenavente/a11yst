# a11yst Shop walkthrough

This walkthrough explains the end-to-end a11yst Shop showcase step by step. Run the demo first:

```bash
pnpm demo full
```

The runner prints a plain-text summary derived from stored audit results. It also writes `.a11yst/demo/demo-summary.md` inside the demo output directory (gitignored).

Automated accessibility testing does not establish WCAG conformance and does not replace manual accessibility testing.

## Step 1 — Baseline

The baseline stage audits a stable slice of the application:

- Route: `/account`
- Profiles: `default`, `keyboard`
- Viewports: mobile and desktop
- Flow: none

a11yst records real findings from Playwright and axe. The demo then runs:

```bash
a11yst baseline create --force
```

That creates `.a11yst/baseline.json` from the baseline audit results. The baseline is not hand-written.

## Step 2 — Current state

The current stage expands coverage:

- Routes: `/account`, `/checkout`
- Same profiles and viewports
- Flow: `checkout-help`

New checkout barriers appear as **new** findings during comparison. The stable account issue remains **known**.

## Step 3 — Interactive flow

The `checkout-help` flow:

1. Starts on `/checkout`
2. Clicks `#open-help`
3. Audits checkpoint `help-dialog-open`

a11yst records findings with structured flow metadata (`flowId`, `checkpointId`). Interactive findings are counted from that metadata, not from page titles.

## Step 4 — Regression comparison

After baseline creation, the current audit compares against stored fingerprints:

- **Known** — findings already recorded in the baseline
- **New** — findings not present in the baseline
- **Regressed** / **Resolved** — only shown when a11yst produces those lifecycle statuses

The demo runner prints counts derived from stored results. Example labels:

```text
Known findings: <derived from run>
New findings: <derived from run>
```

## Step 5 — Source analysis

When source analysis is enabled, a11yst maps findings to project files when evidence is sufficient.

Example from a typical run:

- `button-name` → `site/checkout.html`
- `image-alt` → `site/account.html`

Paths are relative to the demo project. Line numbers may change as the HTML evolves, so this walkthrough references files rather than brittle line/column values.

## Step 6 — Recommendations

Recommendations provide review guidance for supported rules such as `button-name`, `label`, and `image-alt`.

They include:

- suggested actions
- verification steps
- generic examples when appropriate

They are **not** patches, codemods, or automatic fixes.

## Step 7 — Policy

The current stage enables CI policy (`failOnNew`, `minimumSeverity: high`).

When new high-severity findings appear, `a11yst audit` may exit `2`. That is a configured policy breach, not an operational failure.

The demo runner may exit `0` after `demo full` while still printing:

```text
Current audit exit: 2
Configured policy breach: yes
```

Direct `pnpm a11yst audit` still returns `2` when policy fails.

## Step 8 — Reports

After the current audit, a11yst writes reports under `.a11yst/results/runs/<audit-id>/`:

| Format | Purpose |
| --- | --- |
| HTML | Human-readable audit report |
| JSON | Stored results for tooling |
| SARIF | CI and editor integrations |
| Markdown | Text summary report |
| JUnit | CI test result consumers |
| GitHub annotations | Workflow annotation output |

See [Reports](../../docs/reports.md) for product-level report documentation.

The demo also writes `.a11yst/demo/demo-summary.md` — a short index derived from the same stored results without re-running the audit.

## Useful commands

```bash
pnpm demo full      # baseline -> create baseline -> current -> summary
pnpm demo current   # current audit only (may exit 2)
pnpm demo clean     # remove demo output under .a11yst/
pnpm demo help
```

## What this teaches

The showcase demonstrates:

- application coverage through routes, profiles, and viewports
- interactive state through flows and checkpoints
- regression awareness through baseline comparison
- source context through mapping and recommendations
- governance through CI policy and multiple report formats

It does not claim that a11yst found every accessibility barrier or that the demo store is accessible.
