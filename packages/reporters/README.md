# `@a11yst/reporters` [![NPM version](https://img.shields.io/npm/v/@a11yst/reporters.svg?style=flat)](https://www.npmjs.com/package/@a11yst/reporters) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE) [![NPM total downloads](https://img.shields.io/npm/dt/@a11yst/reporters.svg?style=flat)](https://www.npmjs.com/package/@a11yst/reporters)

Static reporting for a11yst `AuditExecutionResult` documents.

## Public API

### HTML

- `generateHtmlReport({ auditResult, outputDirectory, auditId? })` writes
  `report/index.html`, `report/styles.css`, and `report/report.js`.
- `renderHtmlReport(result, options?)`, `renderReportStyles()`, and
  `renderReportScript()` return individual report assets as strings.

### Markdown

- `generateMarkdownReport(input, options?)` returns deterministic GitHub Flavored
  Markdown from audit results, policy evaluation, and baseline summaries.
- Bundle path during audit: `reports/a11yst.md`
- Enable with `a11yst audit --markdown` or `reports.markdown` in config.
- Custom copy: `a11yst audit --markdown-output <path>`
- Offline generation: `a11yst report --from results.json --format markdown --output a11yst.md`

Markdown reports summarize CI policy status, lifecycle counts, breaches, comparison
coverage, classifications, and artifact links. They do not assert WCAG conformance.

### GitHub Actions annotations

- `generateGitHubAnnotations(input, options?)` returns workflow commands as a string
  (not written to stdout by a11yst).
- Bundle path during audit: `reports/github-annotations.txt`
- Enable with `a11yst audit --github-annotations`
- Custom copy: `a11yst audit --github-annotations-output <path>`
- Offline generation: `a11yst report --from results.json --format github-annotations`

In GitHub Actions, pipe the artifact file to stdout in your workflow step, for
example `cat reports/github-annotations.txt`. a11yst does not upload results,
create PR comments, or call GitHub APIs.

Annotations are limited to policy breaches, policy not-evaluated errors, and
operational run failures. Known, resolved, and not-compared findings do not
generate individual annotations by default.

Source file locations are included only when a validated relative `sourceLocation`
exists on a finding. a11yst does not invent paths.

### GitHub Step Summary

- `a11yst audit --github-step-summary` appends the same Markdown report to the
  path in `GITHUB_STEP_SUMMARY` when that variable is set.
- Does not require `--markdown` unless you also want the bundle artifact.
- Does not expose the absolute Step Summary path in manifest or results.
- Preserves existing summary content via append.

### Shared

- `readAuditResult(path)` parses and validates a persisted result.
- `validateAuditResultDocument(value)` validates the schema boundary consumed
  by reporters. Schema version `"1"` is currently supported.

## Security and privacy

Report text is escaped for HTML and Markdown. GitHub workflow commands use
property and message escaping to prevent command injection. Keep generated
directories and evidence together, and treat bundles as sensitive. a11yst does
not upload report data or implement telemetry.

Complete GitHub Actions workflow templates are added in Phase 9g.

## Report accessibility

HTML reports include semantic landmarks, skip links, labeled controls, and
reduced-motion styles. These features do not change audit limitations:

a11yst does not certify WCAG conformance.

Automated checks cover only part of accessibility.

Manual review and testing with disabled users remain necessary.
