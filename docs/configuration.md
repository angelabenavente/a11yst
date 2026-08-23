# Configuration

a11yst reads a single configuration file from your project. This guide covers public options beyond the minimal example in [Getting Started](./getting-started.md).

## Configuration file

Supported filenames (searched upward from the working directory):

- `a11yst.config.ts`
- `a11yst.config.mts`
- `a11yst.config.js`
- `a11yst.config.mjs`

Use `defineConfig` from `@a11yst/config` when authoring TypeScript configs. Paths in the file are resolved relative to the configuration file directory unless noted.

Point the CLI at a directory with `--cwd` or pass `--config <path>`. This checkout does not include an `init` command.

## Top-level options

| Option | Default | Purpose |
| --- | --- | --- |
| `outputDir` | `.a11yst/results` | Persisted audit bundles |
| `evidence` | `{ screenshots: true, fullPage: false }` | Screenshot capture defaults |
| `reports` | HTML and Markdown on; SARIF/JUnit off | Report generation defaults |
| `baseline` | `.a11yst/baseline.json`, compare on | Baseline comparison |
| `ci` | all policy flags off | CI policy defaults |
| `sourceAnalysis` | all features on | Source mapping, ranking, recommendations |
| `projects` | required (min 1) | Projects to audit |

See dedicated guides for [profiles](./profiles.md), [flows](./flows.md), [baselines](./baselines-and-governance.md), [source analysis](./source-analysis.md), and [reports](./reports.md). CI execution is covered in [CI](./ci.md).

## Advanced example

Example:

```typescript
import { defineConfig } from "@a11yst/config";

export default defineConfig({
  outputDir: ".a11yst/results",
  sourceAnalysis: { enabled: true, ranking: true, recommendations: true },
  reports: { html: true, sarif: true, markdown: true },
  baseline: { file: ".a11yst/baseline.json", compare: true, classifications: true },
  ci: {
    failOnNew: true,
    failOnRegression: true,
    failOnExpiredClassification: true,
    minimumSeverity: "high",
  },
  projects: [
    {
      name: "docs-web",
      platform: "web",
      framework: "html",
      baseUrl: "http://127.0.0.1:3000",
      devServer: {
        command: "node serve.mjs",
        url: "http://127.0.0.1:3000",
        reuseExisting: true,
        startupTimeout: 60_000,
      },
      routes: [{ id: "home", path: "/" }, "/about"],
      profiles: ["default", "keyboard", "large-text"],
      viewports: [
        { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
        { name: "desktop", width: 1440, height: 900 },
      ],
      flows: [/* see flows guide */],
    },
  ],
});
```

## Projects

Each project requires a unique `name`. Web projects also need `platform: "web"`, a `framework`, and either `baseUrl` or `devServer.url`.

| Key | Notes |
| --- | --- |
| `rootDir` | Project root relative to config file (default `.`) |
| `baseUrl` | Origin for route planning and navigation |
| `devServer` | Optional server lifecycle (see below) |
| `routes` | Explicit routes; required when `routeDiscovery.mode` is `off` |
| `routeDiscovery` | Adapter-based discovery (`off`, `fallback`, `merge`) |
| `profiles` | Accessibility profiles (default `[default]`) |
| `viewports` | Browser dimensions (default desktop 1440×900) |
| `flows` | Interactive audit scenarios |
| `readiness` | Navigation wait strategy (`waitUntil`, optional selector) |

`platform` is `web` only. React Native runtime audits are not supported.

## Dev server

When `devServer.command` is set and nothing responds at the configured URL, a11yst can start the command, wait for `devServer.url`, run audits, and stop only the server it started.

| Key | Default | Purpose |
| --- | --- | --- |
| `command` | — | Shell command to start the app |
| `url` | — | Readiness URL (also satisfies `baseUrl` when omitted) |
| `reuseExisting` | `true` | Reuse a server already listening at `url` |
| `startupTimeout` | `60000` | Startup timeout in milliseconds |

Use `pnpm a11yst audit --no-start-server` to fail fast when the app is not already running. Server startup failures surface as operational errors (exit `1`).

## Routes

Routes may be structured objects (`{ id, name, path }`) or path strings. a11yst normalizes IDs and names deterministically.

Route discovery (`routeDiscovery.mode`):

| Mode | Behavior |
| --- | --- |
| `off` | Only explicit `routes` |
| `fallback` | Discover when `routes` is empty; otherwise keep explicit routes |
| `merge` | Merge explicit routes with adapter discovery |

Dynamic patterns (for example `/blog/:slug`) are skipped unless you provide `routeDiscovery.samples` with concrete paths.

Framework support varies: HTML and Nuxt discover filesystem routes; Next.js discovers static App/Pages routes; React discovers common React Router JSX and object routes (see [React route discovery](./react-route-discovery.md)); Vue and Angular rely primarily on explicit routes or `/` fallback. a11yst does not parse Angular Router source files.

Inspect resolved routes without a browser:

```bash
pnpm a11yst routes --cwd <project>
pnpm a11yst routes --explain --cwd <project>
```

## Viewports

Each viewport requires `name`, `width`, and `height`. Optional fields:

- `deviceScaleFactor` (default `1`)
- `isMobile` (default `false`)
- `hasTouch` (default `false`)
- `orientation` (inferred from dimensions when omitted)

Planned web route runs multiply **routes × profiles × viewports**. Flow checkpoint runs multiply **checkpoints × profiles × viewports** for each configured flow.

## Reports configuration

| Key | Default |
| --- | --- |
| `html` | `true` |
| `sarif` | `false` (or `{ enabled, output? }`) |
| `junit` | `false` |
| `markdown` | `true` |

Audit CLI flags can override config for a single run. See [Reports](./reports.md).

## Baseline configuration

| Key | Default |
| --- | --- |
| `file` | `.a11yst/baseline.json` |
| `compare` | `true` |
| `classifications` | `true` |

See [Baselines & governance](./baselines-and-governance.md).

## CI policy configuration

| Key | Default |
| --- | --- |
| `failOnNew` | `false` |
| `failOnRegression` | `false` |
| `failOnExpiredClassification` | `false` |
| `minimumSeverity` | `high` |

Policy requires baseline comparison when enabled. Severity levels use the [canonical a11yst model](./severity-model.md) (`minor`, `medium`, `high`, `critical`). See [CI](./ci.md) for exit codes.

## Source analysis configuration

Public options only:

| Key | Default |
| --- | --- |
| `enabled` | `true` |
| `ranking` | `true` |
| `recommendations` | `true` |

No public thresholds or ranking weights exist in configuration. See [Source analysis](./source-analysis.md).

## Next steps

- [Profiles](./profiles.md) — accessibility profile behavior
- [Flows](./flows.md) — interactive checkpoints
- [Baselines & governance](./baselines-and-governance.md) — regression and classifications
