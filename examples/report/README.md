# Report example apps

These deterministic Phase 4 fixtures exercise local evidence bundles and static
HTML reports without fetching data at runtime:

- `multi-route-html`: three HTML routes and two viewports (6 runs).
- `responsive-react`: two routes, two profiles, and two viewports (8 planned
  runs: 4 executable `default` runs and 4 skipped `keyboard` runs).
- `mixed-workspace`: 1 planned web run from a monorepo-style `apps/web` layout.

## Privacy and output

The apps use only local content and bind their controlled servers to
`127.0.0.1`. a11yst output is written locally under `.a11yst/results` relative
to each config unless the caller overrides it. Audit output can contain page
HTML snippets, accessibility findings, URLs, and screenshots, including visible
or sensitive data. Protect the output directory, inspect it before sharing, and
do not publish it without review. a11yst does not upload the output or implement
telemetry. Add `.a11yst/` to your own `.gitignore` when appropriate; the audit
does not modify `.gitignore`.

## Run

From the repository root:

```sh
pnpm a11yst audit --cwd examples/report/multi-route-html
open examples/report/multi-route-html/.a11yst/results/runs/<auditId>/report/index.html
```

```sh
pnpm a11yst audit --cwd examples/report/responsive-react
```

```sh
pnpm a11yst audit --cwd examples/report/mixed-workspace
```

Each config lets a11yst start its local server automatically. To run one
manually first, use:

```sh
pnpm --dir examples/report/multi-route-html start       # 127.0.0.1:4181
pnpm --dir examples/report/responsive-react dev         # 127.0.0.1:5181
pnpm --dir examples/report/mixed-workspace/apps/web start # 127.0.0.1:6181
```

Set the same `PORT` environment variable for both server and audit when
overriding those fallback ports.

## Regenerate and open a report

The report uses local assets only and opens directly from `file://`; it needs
no server, CDN, internet connection, or browser rerun.

```sh
# Follow this example's .a11yst/results/latest.json
pnpm a11yst report --cwd examples/report/multi-route-html

# Read an explicit result and write report/ beneath a custom directory
pnpm a11yst report \
  examples/report/multi-route-html/.a11yst/results/runs/<auditId>/results.json \
  --output ./report-review

open ./report-review/report/index.html
```
