# Reports and output formats

a11yst persists audit results as portable JSON bundles and can generate multiple report formats from a single audit or from stored results.

Default output directory: `.a11yst/results` (relative to the configuration file).

## Result bundle

Each audit creates:

```text
<outputDir>/
├── latest.json
└── runs/<auditId>/
    ├── manifest.json
    ├── results.json
    ├── baseline-comparison.json   # when baseline comparison ran
    ├── report/                    # when HTML enabled
    ├── reports/a11yst.md          # Markdown report (default)
    └── evidence/                  # when screenshots captured
```

- **`results.json`** — canonical stored audit payload (`schemaVersion: "1"`)
- **`manifest.json`** — bundle index with relative artifact paths
- **`latest.json`** — pointer to the most recent run

Machine-readable audit output: `pnpm a11yst audit --json` (stdout).

## JSON results

- Full audit payload for tooling and archival.
- Includes findings, runs, summary, environment metadata, optional baseline comparison, source mapping, and recommendations when source analysis ran during the audit.
- Suitable for custom integrations and regeneration.

## HTML report

- Human-readable static report (`report/index.html`).
- Includes findings, evidence, screenshots, profile coverage, baseline lifecycle sections when comparison ran, source mapping summaries, and recommendations.
- Works offline with relative assets; no server required.
- Does not claim WCAG compliance.

Enabled by default (`reports.html: true`). Disable with `--no-html`.

## SARIF

- SARIF 2.1.0 for security and quality tooling ecosystems.
- Physical source locations are included only when mapping is sufficiently material and valid per implementation rules.
- **Ambiguous** mappings do not invent a physical location.

Enable in config (`reports.sarif: true`) or per audit (`--sarif`, `--sarif-output <path>`).

## JUnit

- JUnit XML for CI test-result interoperability.
- Does not expand source-analysis detail beyond the JUnit format’s scope.

Enable with `reports.junit: true` or `--junit`.

## Markdown

- Human-readable summary suitable for GitHub issues, merge requests, GitLab review, or archival.
- Generated from the same stored `results.json` as HTML — no re-audit.
- Includes audit metadata, severity summary, grouped findings, source locations, recommendations, baseline lifecycle, and coverage sections when present.
- Relative links to `report/index.html` and `results.json` inside the bundle.

Enabled by default (`reports.markdown: true`). Disable with `--no-markdown` or `reports.markdown: false`.

## GitHub annotations

- Emits GitHub Actions workflow annotation commands.
- **Exact** and **high** confidence mappings may reference file and line when policy allows.
- **Medium**, **low**, and **ambiguous** mappings use conservative messaging without arbitrary first-candidate locations.

Enable with `reports.githubAnnotations: true` or `--github-annotations`. Pipe the generated file to stdout in GitHub Actions; a11yst does not upload results automatically.

`githubStepSummary` appends the Markdown report to `GITHUB_STEP_SUMMARY` when set.

## Regenerate reports from stored results

`pnpm a11yst report` reads persisted JSON **without** launching a browser, re-auditing, or re-running source indexing, ranking, or recommendation generation.

```bash
# Follow latest.json for configured outputDir
pnpm a11yst report

# Explicit results file
pnpm a11yst report .a11yst/results/runs/<auditId>/results.json

# Other formats
pnpm a11yst report .a11yst/results/runs/<auditId>/results.json --format sarif
pnpm a11yst report .a11yst/results/runs/<auditId>/results.json --format junit
pnpm a11yst report .a11yst/results/runs/<auditId>/results.json --format markdown
pnpm a11yst report .a11yst/results/runs/<auditId>/results.json --format github-annotations

# Custom output location
pnpm a11yst report --output ./review-copy
```

Supported `--format` values: `html`, `sarif`, `junit`, `markdown`, `github-annotations`.

Without `--output`, HTML writes `report/` next to `results.json`.

## Audit flags (summary)

Report-related audit flags include `--no-html`, `--sarif`, `--junit`, `--markdown`, `--github-annotations`, and matching `--no-*` / `-*-output` variants. CLI values override configuration for that run.

See `pnpm a11yst audit --help` for the complete list.

## Limitations

- Optional formats are not generated unless enabled in config or requested on the CLI.
- Regenerated reports reflect data stored in `results.json`; they do not recompute source analysis.
- Screenshots and snippets may contain sensitive page content.

## Next steps

- [CI](./ci.md) — use SARIF, JUnit, and policy in pipelines
- [Source analysis](./source-analysis.md) — mapping and recommendations semantics
- [Baselines & governance](./baselines-and-governance.md) — lifecycle data in HTML reports
