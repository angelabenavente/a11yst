# Continuous integration

a11yst runs accessibility audits in CI with deterministic exit codes, multiple report formats from a single audit, and copyable workflow templates under [examples/ci/](../examples/ci/).

> a11yst does not certify WCAG conformance. CI reports surface accessibility findings and policy breaches; they are not compliance certificates.

## Prerequisites

- **Node.js** `>= 20` (this repository uses `.nvmrc` with `20`)
- **pnpm** via Corepack, matching `packageManager` in `package.json` (`pnpm@9.15.0` in this monorepo)
- **Playwright Chromium** installed in the CI image or during the job
- A configured **`a11yst.config.ts`** with projects, routes, and optionally a dev server
- A versioned **`.a11yst/baseline.json`** when using baseline-aware CI policy

Chromium installation is separate from npm package installation:

```bash
pnpm exec playwright install chromium
```

In Debian-based CI runners, use `--with-deps` to install system libraries:

```bash
pnpm exec playwright install --with-deps chromium
```

## Installation

Install `@a11yst/cli` as a development dependency. The package exposes the `playwright` binary so the Chromium install command works under pnpm.

```bash
pnpm add -D @a11yst/cli
pnpm exec playwright install chromium
```

Add a11yst as a dev dependency in the application repository that owns the audit target — not in a shared infra repo unless that repo contains the application under test.

## Baseline in Git

Commit **`.a11yst/baseline.json`** to record known accessibility debt and enable comparison in CI.

Keep **`.a11yst/results/`** out of version control unless you deliberately archive audit bundles:

```gitignore
.a11yst/results/
```

> A baseline records known accessibility debt. It does not make that debt accessible or compliant.

Do **not** create or refresh baselines automatically in CI. Do **not** run:

```bash
a11yst baseline update --accept-new
```

inside a pipeline. Accept new findings locally or in a controlled workflow outside CI.

## Recommended CI policy

Example configuration ([examples/ci/a11yst.config.ts](../examples/ci/a11yst.config.ts)):

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
    githubAnnotations: false,
    githubStepSummary: false,
  },
});
```

CLI flags override config for that run. The templates pass explicit flags so pipeline behavior is visible in the workflow file.

## Exit codes

| Exit code | Meaning |
| --- | --- |
| `0` | Audit completed; CI policy disabled or passed |
| `1` | Operational/configuration error, partial or failed audit, or policy not evaluated |
| `2` | Audit completed; configured CI policy failed |

**Exit `2` is not a crash.** It means the audit finished and the configured policy detected breaches at or above `--minimum-severity`.

**Exit `1` must not be converted to `2`.** Operational failures and "policy not evaluated" (for example, baseline missing when required) are exit `1`.

### Partial audits

An audit result has status **`completed-with-errors`** when useful audit work completed but an operational part of the audit did not—for example, one planned run completed while another failed, or default HTML report generation failed after execution. Completed runs can still produce findings and available report artifacts, but the audit did not finish cleanly across its planned work. Therefore:

- `completed-with-errors` always exits **`1`**
- audit incompleteness takes precedence over a failed policy evaluation, so it never exits `2`
- findings from completed runs remain useful, but they must not be interpreted as a complete pass
- CI should publish available artifacts and then preserve exit `1` at the final gate

A result with status **`failed`** also exits `1`; it means no planned run completed or a global operational error prevented execution. Skipped runs, coverage-aware `not-compared` baseline entries, and partial source mapping do not by themselves make an audit `completed-with-errors`.

**Artifacts publish before the gate.** Upload steps use `if: always()` (GitHub) or `artifacts.when: always` (GitLab) so reports remain available when policy fails.

A policy failure does not prevent report generation. Each report format is derived from the same audit result; formats do not re-evaluate policy independently.

## Artifacts produced

Templates write CI-facing outputs under **`.a11yst/ci/`**:

| File | Description |
| --- | --- |
| `.a11yst/ci/a11yst-results.json` | Machine-readable audit result (`--json` redirected to file) |
| `.a11yst/ci/a11yst.sarif` | SARIF 2.1.0 report |
| `.a11yst/ci/a11yst.junit.xml` | JUnit XML report |
| `.a11yst/ci/a11yst.md` | Markdown summary |
| `.a11yst/ci/github-annotations.txt` | GitHub Actions workflow commands (GitHub templates only) |

The audit bundle under **`.a11yst/results/`** may also be uploaded. It can contain HTML reports, screenshots, and evidence paths.

Regenerate formats without a browser:

```bash
pnpm exec a11yst report --from .a11yst/results/latest.json --format sarif --output .a11yst/ci/a11yst.sarif
```

## Report formats

### HTML

Interactive accessible report generated in the audit bundle. May contain screenshots and DOM snippets. Not typically uploaded as a CI artifact path in the templates, but available under `.a11yst/results/`.

### SARIF

- SARIF **2.1.0**
- Uses logical locations when source mapping is unavailable (Phase 10 adds richer source mapping)
- Optional upload to **GitHub Code Scanning** via the Code Scanning template
- Accessibility findings are **not security vulnerabilities** — category is `a11yst`
- Do not assume SARIF alerts include precise source code locations until source mapping exists

### JUnit

- Policy breaches appear as **failures**
- Policy not-evaluated and operational errors appear as **errors**
- GitLab ingests via `artifacts:reports:junit`
- Other CI systems can parse the XML for test-style dashboards

### Markdown

- Human-readable summary for logs and review
- Appended to **`GITHUB_STEP_SUMMARY`** when `--github-step-summary` is set
- Does not certify conformance

### GitHub annotations

- Written to `.a11yst/ci/github-annotations.txt` as workflow commands
- Emit with **`cat`** — never `source`, `eval`, or execute the file as a shell script
- By default includes policy breaches and operational errors relevant to the workflow

### GitHub Step Summary

When `GITHUB_STEP_SUMMARY` is set, a11yst appends the Markdown report. JSON stdout must be redirected to a file so workflow commands are not contaminated.

## GitHub Actions (base)

Copy [examples/ci/github-actions/a11yst-ci.yml](../examples/ci/github-actions/a11yst-ci.yml) to **`.github/workflows/a11yst.yml`**.

**Triggers:** `pull_request`, `push` to `main`, `workflow_dispatch`

**Permissions:** `contents: read` only

**Flow:**

1. Checkout, setup Node from `.nvmrc`, enable Corepack
2. `pnpm install --frozen-lockfile`
3. Install Chromium with Playwright
4. Run **one** `a11yst audit` with policy flags and report outputs
5. Capture exit code without failing the job immediately
6. Emit annotations (`if: always()`)
7. Upload artifacts (`if: always()`)
8. Apply final gate preserving exit `0`, `1`, or `2`

**Action versions** (major tags for readability):

- `actions/checkout@v7`
- `actions/setup-node@v7`
- `actions/upload-artifact@v4`

Teams with strict supply-chain requirements should pin actions to a reviewed commit SHA. Dependabot or Renovate can maintain those references. Do not use `@main`, `@master`, or `@latest`.

## GitHub Actions with Code Scanning

Copy [examples/ci/github-actions/a11yst-code-scanning.yml](../examples/ci/github-actions/a11yst-code-scanning.yml) to **`.github/workflows/a11yst-code-scanning.yml`**.

Adds:

```yaml
permissions:
  contents: read
  security-events: write
```

SARIF upload uses `github/codeql-action/upload-sarif@v4` with the SARIF file produced by the audit — it does not regenerate SARIF.

Upload runs only when `.a11yst/ci/a11yst.sarif` exists. The final gate runs after upload and treats SARIF upload failure as an **operational error (exit 1)**, distinct from policy failure (exit 2).

**Code Scanning availability** depends on repository settings and GitHub plan. Upload may require enabling Code Scanning in repository settings.

## GitLab CI

Copy or include [examples/ci/gitlab/a11yst.gitlab-ci.yml](../examples/ci/gitlab/a11yst.gitlab-ci.yml):

```yaml
include:
  - local: path/to/a11yst.gitlab-ci.yml
```

Uses `node:20-bookworm`, Corepack, frozen install, and Playwright Chromium. The job:

- Runs one audit with policy flags
- Redirects JSON to `.a11yst/ci/a11yst-results.json`
- Prints Markdown to the job log when present
- Exits with the audit status (`0`, `1`, or `2`)
- Publishes artifacts with `when: always`
- Registers JUnit via `artifacts:reports:junit`

SARIF is stored as a generic artifact. This template does not claim native GitLab SARIF integration.

**Rules:** merge requests, default branch, and manual `web` pipeline.

## Pull requests from forks

The **base GitHub template** works with `contents: read` on fork pull requests.

The **Code Scanning template** may lack `security-events: write` on fork pull requests. Do **not** switch to `pull_request_target` to fix this — that would run untrusted fork code with elevated tokens.

Safe approach (implemented in the Code Scanning template):

- Always run the audit and upload generic artifacts
- Skip privileged SARIF upload when `github.event.pull_request.head.repo.full_name != github.repository`
- Apply the same exit-code gate

Fork contributors still receive audit results via artifacts and logs.

## Security and permissions

- Request **minimum permissions**. Base template: `contents: read` only
- Do **not** use `pull_request_target` for a11yst audits
- Do **not** use personal access tokens in workflows
- Do **not** interpolate pull request titles, branch names, or other untrusted input directly into shell scripts
- Do **not** use `eval` or `source` on annotation files
- Do **not** request `write-all`, `contents: write`, `pull-requests: write`, or `id-token: write` unless documented and required
- Pin action versions to SHA when your security policy requires it

## Artifact privacy

CI artifacts may contain:

- Screenshots
- DOM fragments
- Internal URLs
- Route names and paths
- Classification owners, tickets, and reasons
- Product metadata from the audited application

Recommendations:

- Use limited retention (templates use 14 days where supported)
- Restrict who can download workflow artifacts
- Do not publish `.a11yst/results/` as a public site without review
- Do not embed secrets in classification reasons, tickets, or notes
- Do not upload full result bundles to external services by default

Artifacts are **not guaranteed free of sensitive information**.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Exit `1`, policy not evaluated | Baseline missing or `--no-baseline` when policy requires comparison |
| Exit `1` during install | Lockfile out of sync; run `pnpm install` locally and commit `pnpm-lock.yaml` |
| Chromium fails to launch | Run `playwright install --with-deps chromium` on the CI image |
| No annotations in PR | Annotation file missing; check audit completed and path `.a11yst/ci/github-annotations.txt` |
| SARIF not in Security tab | Code Scanning disabled, fork PR, upload skipped, or plan limitations |
| Empty artifacts | Audit failed before writing outputs; check earlier steps |
| Invalid exit code in gate | Audit step did not set `exit_code` output — inspect bash capture block |

Test the audit command locally before enabling CI (see [examples/ci/README.md](../examples/ci/README.md)).

## Related guides

- [Configuration](./configuration.md) — CI policy and report defaults in config
- [Baselines & governance](./baselines-and-governance.md) — lifecycle, classifications, and policy interaction
- [Reports](./reports.md) — SARIF, JUnit, Markdown, and GitHub annotation formats
- [Source analysis](./source-analysis.md) — when SARIF includes physical source locations

## Current limitations

- No GitHub App, GitLab bot, or automatic PR comments
- No cloud-hosted a11yst service
- Ambiguous source mappings do not produce arbitrary physical locations in SARIF or GitHub annotations
- GitLab template does not upload SARIF to a security dashboard
- Templates are examples — verify remote execution in your repository separately
- Accessibility findings in SARIF are not security vulnerabilities

## Configuration reference

Example config: [examples/ci/a11yst.config.ts](../examples/ci/a11yst.config.ts)

Audit flags used in templates:

- `--fail-on-new`
- `--fail-on-regression`
- `--fail-on-expired-classification`
- `--minimum-severity high`
- `--sarif-output .a11yst/ci/a11yst.sarif`
- `--junit-output .a11yst/ci/a11yst.junit.xml`
- `--markdown-output .a11yst/ci/a11yst.md`
- `--github-annotations-output .a11yst/ci/github-annotations.txt` (GitHub only)
- `--github-step-summary` (GitHub only)

See `a11yst audit --help` for the full flag list.
