# a11yst CI examples

These files are **inert examples**. They do not run in the a11yst repository itself. Copy or include them in **your** project to enable CI audits.

## What to copy

| File | Copy to | Purpose |
| --- | --- | --- |
| `github-actions/a11yst-ci.yml` | `.github/workflows/a11yst.yml` | GitHub Actions audit with annotations, Step Summary, and artifacts |
| `github-actions/a11yst-code-scanning.yml` | `.github/workflows/a11yst-code-scanning.yml` | Same as above, plus optional SARIF upload to GitHub Code Scanning |
| `gitlab/a11yst.gitlab-ci.yml` | Include from `.gitlab-ci.yml` | GitLab CI job with JUnit and artifact upload |
| `a11yst.config.ts` | Project root (optional) | Example configuration with CI policy and report defaults |

## Before you activate CI

1. **Install a11yst** in your application repository (see [docs/ci.md](../../docs/ci.md#installation)).
2. **Install Playwright Chromium** once per machine or CI image:
   ```bash
   pnpm exec playwright install chromium
   ```
   The templates use `pnpm exec playwright install --with-deps chromium` in CI for Debian-based runners.
3. **Commit a baseline** when you are ready to track known accessibility debt:
   ```text
   .a11yst/baseline.json
   ```
   Do **not** run `a11yst baseline update --accept-new` inside CI.
4. **Add `.a11yst/results/` to `.gitignore`** unless you deliberately version audit bundles.

## Node.js and pnpm

The GitHub templates read Node from `.nvmrc` via `actions/setup-node`. This repository declares:

- `engines.node`: `>=20`
- `.nvmrc`: `20`
- `packageManager`: `pnpm@9.15.0`

In your project:

- Keep `.nvmrc` (or `.node-version`) aligned with your supported Node version.
- Enable Corepack so pnpm matches `packageManager` in `package.json`.
- The templates run `pnpm install --frozen-lockfile`.

If your repository has no Node version file, switch the GitHub template to an explicit `node-version` and document how to keep it aligned.

## GitHub Actions: base vs Code Scanning

**`a11yst-ci.yml`** (base):

- Minimal permissions (`contents: read`).
- Runs one audit, emits GitHub annotation commands, writes Step Summary, uploads artifacts.
- Works on pull requests from forks with read-only permissions.

**`a11yst-code-scanning.yml`** (Code Scanning variant):

- Adds `security-events: write` for SARIF upload.
- Uploads `.a11yst/ci/a11yst.sarif` via `github/codeql-action/upload-sarif@v4`.
- Skips SARIF upload on pull requests from forks (audit and artifacts still run).
- Requires GitHub Code Scanning availability on your repository/plan.

Use the base template unless you need SARIF in the Security tab.

## GitLab CI

Include the job from your root `.gitlab-ci.yml`:

```yaml
include:
  - local: path/to/a11yst.gitlab-ci.yml
```

Adjust the path after copying the file. GitLab ingests JUnit via `artifacts:reports:junit`. SARIF is stored as a generic artifact only — GitLab has no native SARIF integration in this template.

## Configuration vs CLI flags

`a11yst.config.ts` in this directory demonstrates CI policy and report defaults. CLI flags override config for that run. The templates pass explicit policy and output flags so behavior is visible in the workflow file; you may remove redundant flags once config is trusted.

## Test locally

Run the same command the templates use (from your project root):

```bash
mkdir -p .a11yst/ci

pnpm exec a11yst audit \
  --fail-on-new \
  --fail-on-regression \
  --fail-on-expired-classification \
  --minimum-severity high \
  --sarif-output .a11yst/ci/a11yst.sarif \
  --junit-output .a11yst/ci/a11yst.junit.xml \
  --markdown-output .a11yst/ci/a11yst.md \
  --github-annotations-output .a11yst/ci/github-annotations.txt \
  --github-step-summary \
  --json > .a11yst/ci/a11yst-results.json

echo "Exit code: $?"
```

Inspect `.a11yst/ci/` for generated reports. Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | Audit completed; policy disabled or passed |
| `1` | Operational/configuration error, or policy not evaluated |
| `2` | Audit completed; configured CI policy failed |

## Action version pinning

Examples use major version tags (`@v7`, `@v4`) for readability. Teams with strict supply-chain requirements should pin actions to a reviewed commit SHA. Dependabot or Renovate can maintain those references.

## Full documentation

See [docs/ci.md](../../docs/ci.md) for prerequisites, security, artifact privacy, fork behavior, troubleshooting, and limitations.
