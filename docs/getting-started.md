# Getting Started

Install a11yst in the project you want to audit:

```bash
pnpm add -D @a11yst/cli
pnpm exec playwright install chromium
pnpm exec a11yst --help
```

## Prerequisites

- Node.js `>= 22.12`
- pnpm `9.x` (Corepack reads `packageManager` from `package.json`)
- Playwright Chromium for browser audits

## 1. Prepare a development checkout

From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm exec playwright install chromium
pnpm a11yst --help
```

The workspace exposes the CLI as `pnpm a11yst`, which runs `node packages/cli/dist/bin.js`.

Chromium installation is required once per machine or CI image before `audit`. It is separate from installing Node dependencies.

## Progress feedback

Interactive terminals show progress automatically while long commands run (`audit`, `detect`, `routes`, `report`, and others). Progress writes to **stderr** so stdout stays safe for piping.

```bash
# Disable progress explicitly
pnpm a11yst audit --progress never

# Alias
pnpm a11yst audit --no-progress
```

In CI or when stderr is not a TTY, `--progress auto` (the default) disables spinner animation so logs stay clean. Machine-readable output (`--json`, SARIF, JUnit, Markdown artifacts) never includes spinner frames or ANSI escape codes.

Progress and color are independent: `NO_COLOR` and `--color never` affect ANSI styling only, not whether textual progress appears when `--progress always` is set on a non-interactive stream.

## 2. Try the HTML example

[`examples/audit/html-accessible`](../examples/audit/html-accessible) is a minimal static HTML site with an a11yst configuration and a zero-dependency dev server.

Configuration (abbreviated from the example):

```typescript
import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 4177;

export default defineConfig({
  projects: [
    {
      name: "audit-html-accessible",
      rootDir: ".",
      platform: "web",
      framework: "html",
      baseUrl: `http://127.0.0.1:${PORT}`,
      devServer: {
        command: "node serve.mjs",
        url: `http://127.0.0.1:${PORT}`,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes: ["/"],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
});
```

## 3. Run your first audit

```bash
pnpm a11yst audit --cwd examples/audit/html-accessible
```

a11yst plans one run for this example: one route × one profile × one viewport.

If nothing is listening at `baseUrl`, a11yst runs `devServer.command`, waits for the server URL, executes the audit, and stops only the server it started.

Useful flags (see `pnpm a11yst audit --help` for the full list):

- `--json` — emit machine-readable results on stdout
- `--no-start-server` — never start a dev server; fail if the app is not already up
- `--output <path>` — override `outputDir` for this run
- `--no-html` — skip HTML report generation

Automated accessibility testing can identify many barriers but does not establish WCAG conformance or replace manual testing.

## 4. Find the results

Default `outputDir` is `.a11yst/results`, relative to the configuration file.

After a successful audit you should see a bundle similar to:

```text
examples/audit/html-accessible/.a11yst/results/
├── latest.json
└── runs/<auditId>/
    ├── manifest.json
    ├── results.json
    ├── report/
    │   └── index.html
    └── evidence/
        └── ...
```

- **`results.json`** — full audit payload (findings, runs, summary, environment metadata)
- **`manifest.json`** — bundle index with relative paths to artifacts
- **`latest.json`** — pointer to the most recent run under `outputDir`
- **`report/index.html`** — static HTML report (unless disabled)
- **`reports/a11yst.md`** — Markdown report (unless disabled)
- **`evidence/`** — screenshots when capture is enabled

Optional formats (SARIF, JUnit, GitHub annotations) are not generated unless enabled in configuration or requested with audit flags such as `--sarif`, `--junit`, or `--github-annotations`.

### Reading a finding

Human output and JSON findings include rule id, severity, title, location (route or flow checkpoint), profile, viewport, and optional source-mapping or recommendation fields.

Conceptually:

```text
button-name
HIGH
/checkout route
source: CheckoutButton.tsx (confidence may be exact, high, medium, low, ambiguous, or unmapped)
recommendation: contextual guidance — not an automatic fix
```

Exact field names and shapes depend on the finding and framework. Source mapping can remain unmapped when evidence is insufficient.

## 5. Initialize a new project

To create a starter configuration in an empty web project directory:

```bash
mkdir my-site && cd my-site
# add at least a minimal index.html or app files
pnpm a11yst init --cwd .
```

`init` writes `a11yst.config.ts` in the target directory. It does not modify other project files. Re-run with `--force` to overwrite an existing config.

Detection fills platform, framework, routes or route discovery, profiles, and viewports when signals are available. Review generated values before auditing production apps.

Generated configs include `outputDir: ".a11yst/results"` by default.

## 6. Regenerate reports

`report` reads persisted JSON and does not launch Chromium:

```bash
pnpm a11yst report --cwd examples/audit/html-accessible
pnpm a11yst report --cwd examples/audit/html-accessible \
  .a11yst/results/runs/<auditId>/results.json --format sarif
```

Without a positional path, a11yst follows `latest.json` under the configured `outputDir`.

## 7. Create a baseline

Baselines record known findings so later audits can label lifecycle status.

After you have at least one completed audit bundle:

```bash
pnpm a11yst baseline create --cwd examples/audit/html-accessible
pnpm a11yst baseline status --cwd examples/audit/html-accessible
```

Lifecycle labels on findings:

| Status | Meaning |
| --- | --- |
| `new` | Present now, absent from baseline |
| `known` | Present in both with unchanged severity |
| `regressed` | Known finding worsened or classification expired |
| `resolved` | In baseline but not found in current audit |
| `not-compared` | In baseline but outside current audit coverage |

Fingerprints match findings deterministically; changing routes, flows, profiles, or viewports affects comparison coverage.

Classification workflows (`classify`, `unclassify`, migrations, and advanced baseline updates) are covered in [Baselines & governance](./baselines-and-governance.md).

## 8. Check your environment

```bash
pnpm a11yst doctor --cwd examples/audit/html-accessible
```

Doctor verifies Node version, configuration validity, writable artifact paths, and related readiness checks without starting a browser.

## 9. Next steps

Advanced guides:

- [Configuration](./configuration.md) — full configuration reference
- [Profiles](./profiles.md) — accessibility profile behavior
- [Flows](./flows.md) — interactive checkpoint audits
- [Baselines & governance](./baselines-and-governance.md) — regression and classifications
- [Source analysis](./source-analysis.md) — mapping and recommendations
- [Reports](./reports.md) — output formats and regeneration

Examples and CI:

- [CI guide](./ci.md) — policy, exit codes, and workflow templates
- [Framework examples](../examples/frameworks/) — React, Next.js, Vue, Nuxt, Angular, and HTML fixtures
- [Baseline examples](../examples/baseline/) — regression, classifications, and flow checkpoints
- [Flow examples](../examples/flows/) — interactive checkpoint audits

For product positioning and capability overview, see the [README](../README.md).

## Disclaimer

Automated accessibility testing can identify many barriers, but it does not establish WCAG conformance and does not replace manual testing with keyboards, screen readers, zoom, and other assistive technologies.

Recommendations are guidance, not automatic fixes. Source mapping may be ambiguous or unmapped.
