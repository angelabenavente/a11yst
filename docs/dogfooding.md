# Dogfooding a11yst on a real project

Use this checklist to validate a11yst against an external application without modifying that project's source unless you explicitly intend to.

## Prerequisites

- Node.js 20 or newer
- pnpm 9.15 (or the version pinned in the a11yst repository)
- Playwright Chromium for browser audits

From the a11yst repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm exec playwright install chromium
```

## Procedure

### 1. Build a11yst

Ensure packages compile and the CLI is available:

```bash
pnpm build
pnpm a11yst --help
```

### 2. Install Chromium

Browser audits require a local Chromium build:

```bash
pnpm exec playwright install chromium
```

### 3. Run detect

In the target project directory (or with `--cwd`):

```bash
pnpm a11yst detect --cwd /path/to/project
```

Review detected framework, package manager, and suggested next steps.

### 4. Run init (if no config exists)

If the project does not yet have `a11yst.config.ts` / `a11yst.config.mjs`:

```bash
pnpm a11yst init --cwd /path/to/project
```

If a config already exists, preserve it and skip init.

### 5. Inspect target

Open the generated or existing config and confirm:

- `baseUrl` or `devServer.url` points at the application you intend to audit
- the port matches your running dev server
- no secondary/decoy app will be audited instead

Run a quick audit with JSON to confirm the resolved target in output:

```bash
pnpm a11yst audit --cwd /path/to/project --json | head
```

### 6. Run routes --explain

For React (and other supported adapters), inspect route discovery provenance:

```bash
pnpm a11yst routes --explain --cwd /path/to/project
```

Note discovered routes, unresolved patterns, and dynamic-route limitations.

### 7. Run audit

```bash
pnpm a11yst audit --cwd /path/to/project
```

Default artifacts under `.a11yst/results/`:

- `results.json`
- `report/index.html`
- `reports/a11yst.md`

### 8. Inspect CLI output

Confirm human-first presentation:

- execution shows **SUCCESS** when the audit completed; **ISSUES** when barriers were found (not **FAIL** for successful runs)
- summary table with severity labels (`CRITICAL`, `HIGH`, `MEDIUM`, `MINOR`)
- grouped findings (no repeated axe wall for the same rule)
- likely source paths and recommendations when available
- clear manual-review terminology in coverage sections

Try variants:

```bash
NO_COLOR=1 pnpm a11yst audit --cwd /path/to/project
pnpm a11yst audit --cwd /path/to/project --verbose
pnpm a11yst audit --cwd /path/to/project --color always
```

### 9. Inspect Markdown

Open the latest run's `reports/a11yst.md`:

- audit metadata (project, target, framework, routes, profiles, viewports)
- severity summary table and grouped findings
- source locations (relative paths, not absolute home directories)
- recommendations and disclaimer
- no ANSI escape sequences

Regenerate from stored results to verify determinism:

```bash
pnpm a11yst report .a11yst/results/runs/<audit-id>/results.json --format markdown --output /tmp/regenerated.md
```

### 10. Inspect HTML

Open `report/index.html` in a browser. Compare finding counts, severities, and rule IDs with CLI and Markdown.

### 11. Introduce a deliberate issue (optional)

In a branch or local experiment, add a known accessibility defect (missing button name, image alt, etc.). Do not commit to the external project unless that is your intent.

### 12. Audit again

Re-run the audit and confirm new findings appear with canonical severities (`minor`, `medium`, `high`, `critical` — never `serious` or `moderate` in public output).

### 13. Baseline workflow (optional)

When tracking known debt:

```bash
pnpm a11yst audit --cwd /path/to/project --create-baseline
# later
pnpm a11yst audit --cwd /path/to/project --baseline .a11yst/baseline.json
```

Verify new, known, regressed, and resolved labels in CLI, Markdown, and JSON.

## What to record

- configured target URL vs pages actually audited
- route count from `routes --explain`
- finding counts by severity
- whether Markdown/HTML/JSON agree
- any unmapped source locations or manual-review gaps

## Cleanup

Stop dev servers started for the session. Remove temporary audit output if the external project should not retain `.a11yst/` artifacts.
