# Flows and checkpoints

A **route audit** captures the page after navigation. A **flow audit** runs declarative interactions, then audits one or more **checkpoints** where the UI reaches a state worth reviewing.

a11yst flows are accessibility audit scenarios, not a general-purpose end-to-end testing framework.

## Flow model

```text
flow
  → steps (interactions and expectations)
  → checkpoint (full profile audit at current page state)
```

Each flow defines:

| Field | Purpose |
| --- | --- |
| `id` | Stable identifier for CLI and reports |
| `name` | Human-readable label |
| `start` | Route path where the session begins |
| `profiles` | Profiles at each checkpoint (defaults to project profiles) |
| `viewports` | Viewport names (defaults to project viewports) |
| `steps` | Ordered interaction and audit steps |
| `stepTimeout` | Per-step timeout (ms) |
| `navigationTimeout` | Timeout for navigation-sensitive steps |
| `storageState` | Playwright storage state (test environments only) |
| `allowOrigins` | Additional origins permitted for navigation |

List configured flows without a browser:

```bash
pnpm a11yst flows --cwd examples/flows/html-dialog
pnpm a11yst flows --json --project flows-html-dialog
```

Run flow audits:

```bash
pnpm a11yst audit --cwd examples/flows/html-dialog --flow dialog-accessible
pnpm a11yst audit --flows-only
pnpm a11yst audit --routes-only
```

## Supported step actions

| Action | Purpose |
| --- | --- |
| `goto` | Navigate to a URL or path |
| `click` | Click a control |
| `fill` | Fill an input (supports `valueFromEnv` for secrets) |
| `press` | Press a key |
| `check` / `uncheck` | Toggle checkboxes |
| `select` | Select an option |
| `wait-for` | Wait for element state (`visible`, `hidden`, `attached`, `detached`, `enabled`, `disabled`) |
| `wait-for-url` | Wait for URL pattern |
| `expect-visible` | Assert element visible |
| `expect-hidden` | Assert element hidden |
| `expect-text` | Assert text content |
| `expect-url` | Assert current URL |
| `checkpoint` | Run configured profiles against the current page state |

Custom scripts and shell commands are not supported. When a required step fails, later steps and checkpoints in the same session are marked skipped with an explicit reason.

## Locators

Locators identify controls without brittle CSS-only selectors. Resolution preference:

1. Role and accessible name
2. Label text
3. Visible text
4. Placeholder
5. `testId`
6. CSS (last resort)

Serialized locators in output never include filled secret values. Mark sensitive fills with `sensitive: true` to redact values in traces and reports.

## Checkpoints

A `checkpoint` step pauses the flow and runs a full profile audit on the current page state:

- axe-core checks
- a11yst profile checks (`keyboard`, `large-text`, `reduced-motion`)
- Flow-aware a11yst rules (dialog focus, route-change focus, form-error focus)
- Optional screenshots and structured evidence tied to the checkpoint

Checkpoints are full audits, not screenshot-only captures. Findings reference flow and checkpoint IDs in their location metadata.

## Example

The repository validates flow configuration in `examples/flows/html-dialog/a11yst.config.ts`:

```typescript
flows: [
  {
    id: "dialog-accessible",
    name: "Accessible dialog open and close",
    start: "/accessible",
    viewports: ["desktop"],
    steps: [
      { action: "click", locator: { role: "button", name: "Open accessible dialog" } },
      { action: "checkpoint", id: "dialog-open", name: "Accessible dialog open" },
      { action: "click", locator: { role: "button", name: "Close" } },
      { action: "checkpoint", id: "dialog-closed", name: "Accessible dialog closed" },
    ],
  },
],
```

See [examples/flows/html-dialog](../examples/flows/html-dialog/) for the runnable fixture.

## Focus and keyboard

Flow execution reproduces configured interactions only. It does not prove every user journey is accessible, and a11yst does not simulate screen readers.

When the `keyboard` profile runs at a checkpoint, a11yst captures focus-sequence evidence where configured. This supports review but does not certify complete focus order or assistive-technology behavior.

## Limitations

- Flows cover configured scenarios, not exhaustive application behavior.
- Storage state and checkpoint screenshots may contain session data—use controlled test environments.
- `--flows-only` and `--routes-only` filter route vs checkpoint runs independently.

## Next steps

- [Profiles](./profiles.md) — what runs at each checkpoint
- [Baselines & governance](./baselines-and-governance.md) — compare flow findings over time
- [Configuration](./configuration.md) — project-level flow configuration
