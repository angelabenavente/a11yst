# a11yst

Your accessibility analyst.

a11yst is a local CLI for accessibility testing and regression of **web** applications. It audits routes, interactive flows, accessibility profiles, and viewports; can compare findings against a baseline; maps findings back to likely source locations when evidence allows; and writes structured results and reports.

Automated testing does not establish WCAG conformance and does not replace manual accessibility testing.

**Version:** `1.0.0`. The npm distribution is prepared as the public `@a11yst/*` package set, with `@a11yst/cli` as the consumer entry point.

Documentation: [www.a11yst.dev/getting-started](https://www.a11yst.dev/getting-started)

npm: [https://www.npmjs.com/package/@a11yst/cli](https://www.npmjs.com/package/@a11yst/cli)

## What is a11yst?

a11yst runs web accessibility audits with Playwright and axe-core, applies a11yst-owned profile checks, and persists structured results you can review, compare, and feed into CI.

A typical audit plans work across **routes**, optional **flows** with **checkpoints**, **profiles** (for example keyboard or large-text conditions), and **viewports**, then writes JSON results, evidence, and reports under a configurable output directory.

## Why a11yst?

A basic page scanner often answers: _what did axe find on this URL right now?_

a11yst is built for teams that need repeatable coverage and regression tracking:

```text
routes × flows × profiles × viewports
  → findings
  → baseline / regression (new, known, regressed, resolved, not-compared)
  → source analysis (when mappable)
  → CI outputs (JSON, HTML, SARIF, JUnit, Markdown, GitHub annotations)
  → contextual recommendations
```

This model describes how a11yst plans and compares work. It is not a guarantee of total coverage.

### Behavior

Route audits capture a URL after navigation. **Flows** run declarative interactions and audit **checkpoints** where the UI reaches states worth reviewing (dialog open, validation errors visible, and similar).

### Regression

When a baseline file is present, a11yst can compare current findings so teams can distinguish new debt from known debt and spot regressions. A baseline records known debt; it does not make findings pass.

### CI

CI **policy** can fail a job on configured breaches while still completing the audit. Standard report formats support automation pipelines.

### Source analysis

a11yst attempts to relate findings to source code. Results can be exact, high, medium, or low confidence, **ambiguous**, or **unmapped**. a11yst does not invent a location when evidence is insufficient.

### Recommendations

Recommendations combine finding context, framework, source mapping when available, and suggested next steps. They are **guidance**, not patches, codemods, or auto-fixes.

## Key capabilities

- Project and framework detection (`detect`, `init`)
- Route planning and adapter-based discovery (`routes`)
- Accessibility profiles and viewports (`profiles`)
- Interactive flows and checkpoints (`flows`)
- Playwright + axe web auditing with evidence and screenshots (`audit`)
- Baseline comparison, classifications, and lifecycle labels
- CI policy with deterministic exit codes
- Machine-readable JSON results and portable run bundles
- HTML, SARIF, JUnit, Markdown, and GitHub annotation outputs
- Offline report regeneration from stored results (`report`)
- Source mapping, source ranking, and deterministic recommendations

## Framework support

| Framework                              | Runtime audit      | Routes                                                           | Source mapping  | Status             |
| -------------------------------------- | ------------------ | ---------------------------------------------------------------- | --------------- | ------------------ |
| HTML / Vanilla                         | yes                | yes (filesystem)                                                 | yes             | first-class        |
| React                                  | yes                | partial (React Router static forms; explicit routes recommended) | yes             | first-class        |
| Next.js                                | yes                | yes (App/Pages static routes)                                    | yes             | first-class        |
| Vue                                    | yes                | partial (explicit routes recommended)                            | yes             | first-class        |
| Nuxt                                   | yes                | yes (pages/app filesystem routes)                                | yes             | first-class        |
| Angular                                | yes                | partial (explicit routes; no Angular Router parsing)             | yes (templates) | first-class        |
| Svelte / SvelteKit                     | yes (generic web)  | partial                                                          | no              | preview            |
| Astro, Preact, Solid, Qwik, Ember, Lit | runtime-compatible | partial                                                          | no              | runtime-compatible |
| React Native / Expo                    | no                 | n/a                                                              | n/a             | unsupported        |

React Native runtime auditing is not currently supported. `platform` is `web` only.

Detection fixtures live under [examples/detection](./examples/detection). Runnable audit examples live under [examples/audit](./examples/audit).

## Installation

Install the CLI as a development dependency, then install Playwright Chromium:

```bash
pnpm add -D @a11yst/cli
pnpm exec playwright install chromium
pnpm exec a11yst --help
```

Node.js `>= 22.12` is required. Chromium is managed separately by Playwright and is not downloaded automatically during package installation.

## Local development

From a checkout of this repository:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm exec playwright install chromium
pnpm a11yst --help
```

Requirements: Node.js `>= 22.12`, pnpm `9.15.0`, and Playwright Chromium for browser audits.

The workspace exposes the CLI as `pnpm a11yst`, which runs `node packages/cli/dist/bin.js`.

Step-by-step first audit: **[docs/getting-started.md](./docs/getting-started.md)**.

## First audit (overview)

[`examples/audit/html-accessible`](./examples/audit/html-accessible) is a minimal static HTML site with a configured dev server.

```bash
pnpm a11yst audit --cwd examples/audit/html-accessible
```

When `devServer.command` is configured and nothing is listening at `baseUrl`, a11yst starts the server, waits for readiness, runs the audit, and stops only the server it started. Use `--no-start-server` to require an already-running app.

## Understanding results

By default, `outputDir` is `.a11yst/results` (relative to the configuration file). Each audit creates a bundle similar to:

```text
.a11yst/results/
├── latest.json
└── runs/<auditId>/
    ├── manifest.json
    ├── results.json
    ├── report/index.html
    ├── reports/a11yst.md
    └── evidence/
```

Human terminal output summarizes runs and findings. `--json` emits the full machine-readable result on stdout. Each audit writes JSON results, an HTML report, and a Markdown report by default. SARIF and JUnit are optional (`--sarif`, `--junit`, or config).

Findings may include source-mapping fields and recommendation guidance. Source mapping can be ambiguous or unmapped; recommendations are not automatic fixes.

## Routes, flows, and profiles

```bash
pnpm a11yst detect --cwd examples/audit/html-accessible
pnpm a11yst init --cwd examples/audit/html-accessible --force
pnpm a11yst routes --cwd examples/audit/html-accessible
pnpm a11yst profiles
pnpm a11yst doctor --cwd examples/audit/html-accessible
pnpm a11yst flows --cwd examples/flows/html-dialog
```

- **Routes** — explicit config and adapter discovery. Inspect with `routes --explain`.
- **Flows** — declarative steps and checkpoints. See [examples/flows](./examples/flows).
- **Profiles** — `default`, `keyboard`, `large-text`, `reduced-motion`. See [examples/profiles](./examples/profiles).

## Baseline and regression

Audits can compare findings against a versioned baseline file (default `.a11yst/baseline.json`) when `baseline.compare` is true and the file exists.

```bash
pnpm a11yst audit --cwd examples/audit/html-accessible --no-baseline
pnpm a11yst audit --baseline .a11yst/baseline.json
pnpm a11yst baseline create --cwd examples/audit/html-accessible
pnpm a11yst baseline status --cwd examples/audit/html-accessible
```

Lifecycle labels: `new`, `known`, `regressed`, `resolved`, `not-compared`.

Comparison is coverage-sensitive: partial route lists or changed viewports produce `not-compared`, not silent resolutions. See [docs/baselines-and-governance.md](./docs/baselines-and-governance.md).

## Reports

Regenerate reports without rerunning the browser:

```bash
pnpm a11yst report --cwd examples/audit/html-accessible
pnpm a11yst report --cwd examples/audit/html-accessible \
  .a11yst/results/runs/<auditId>/results.json --format markdown
```

Supported `report --format` values: `html`, `sarif`, `junit`, `markdown`, `github-annotations`.

CI integration guide: **[docs/ci.md](./docs/ci.md)** (GitHub Actions and GitLab templates under [examples/ci/](./examples/ci/)).

| Exit code | Meaning                                                                                    |
| --------- | ------------------------------------------------------------------------------------------ |
| `0`       | Audit completed; CI policy disabled or passed                                              |
| `1`       | Operational/configuration error, partial or failed audit, or policy could not be evaluated |
| `2`       | Audit completed; configured CI policy failed                                               |

Accessibility findings alone do not force exit `1`. Policy breaches exit `2` when CI policy flags or config enable them.

## Commands

| Command                   | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `init`                    | Create a starter `a11yst.config.ts`             |
| `detect`                  | Detect platform, framework, and package manager |
| `routes`                  | List resolved routes without a browser          |
| `profiles`                | List accessibility profiles and limitations     |
| `flows`                   | List configured flows and checkpoints           |
| `audit`                   | Run an accessibility audit                      |
| `doctor`                  | Check local environment readiness               |
| `report`                  | Regenerate reports from stored results          |
| `baseline`                | Create, inspect, update, or migrate baselines   |
| `findings`                | List findings from latest or explicit results   |
| `classify` / `unclassify` | Manage baseline classifications                 |

Run `pnpm a11yst <command> --help` for options. This README does not list every flag.

## Limitations

Automated accessibility testing can identify many barriers, but it does not establish WCAG conformance and does not replace manual testing with keyboards, screen readers, zoom, and other assistive technologies.

a11yst does not certify compliance, automatically fix issues, or guarantee that all barriers are found. It is a local CLI in this repository, not a hosted product. Screenshots and reports may contain sensitive page content—handle bundles accordingly.

## Documentation

- [Getting Started](./docs/getting-started.md) — checkout setup, init, first audit, artifacts, baseline
- [Configuration](./docs/configuration.md) — projects, routes, dev server, reports, policy
- [Profiles](./docs/profiles.md) — default, keyboard, large-text, reduced-motion
- [Flows](./docs/flows.md) — interactive checkpoints
- [Baselines & governance](./docs/baselines-and-governance.md) — fingerprints, lifecycle, classifications
- [Source analysis](./docs/source-analysis.md) — mapping, ranking, recommendations
- [Reports](./docs/reports.md) — JSON, HTML, SARIF, JUnit, Markdown, GitHub annotations, regeneration
- [CI guide](./docs/ci.md) — exit codes, policy, SARIF/JUnit/Markdown/GitHub outputs
- [Examples](./examples/) — audit, baseline, flows, frameworks, profiles, and CI fixtures
- [End-to-end demo](./examples/demo/a11yst-shop/README.md) — a11yst Shop showcase

## Contributing

Bug reports, feature proposals, documentation improvements, and pull requests are welcome.

a11yst is finalizing its CLA workflow for external code contributions. Until that workflow is active, external code pull requests may be reviewed but cannot be merged. See [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/contributing-ip.md](./docs/contributing-ip.md).

## License

a11yst Community is licensed under the [Mozilla Public License 2.0 (MPL-2.0)](./LICENSE). See [LICENSE](./LICENSE) and [docs/licensing.md](./docs/licensing.md) for the complete license text and Community guidance.

## Monorepo development

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test:unit
```

Unit files run in parallel. Integration tests (`pnpm test:integration`) use a separate single-worker configuration because they exercise Playwright Chromium, local servers, fixed ports, and child processes.
