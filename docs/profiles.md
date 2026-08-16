# Accessibility profiles

An **accessibility profile** is a reproducible audit condition: browser preferences, transformations, and a11yst-owned checks. Profiles are not the same as framework adapters (which handle route discovery and readiness).

a11yst ships four web profiles:

| ID | Purpose |
| --- | --- |
| `default` | Automated browser accessibility checks |
| `keyboard` | Focus traversal and keyboard reachability heuristics |
| `large-text` | 200% injected text scaling and layout comparison |
| `reduced-motion` | `prefers-reduced-motion` emulation and motion comparison |

List capabilities without launching a browser:

```bash
pnpm a11yst profiles
pnpm a11yst profiles --json
```

Run a subset from the CLI:

```bash
pnpm a11yst audit --profile keyboard --profile reduced-motion
```

## Planning model

**Route audits** plan runs as:

```text
routes × profiles × viewports
```

**Flow audits** plan checkpoint runs as:

```text
flow checkpoints × profiles × viewports
```

(within each flow’s configured profile and viewport subset)

Skipped work is never represented as a pass. Comparative profiles (`large-text`, `reduced-motion`) may capture an internal default reference when `default` is not in the planned set; that reference is recorded as a diagnostic, not as a completed default audit run.

## default

- Runs automated browser accessibility checks (including open-source rule evaluation via axe-core).
- Provides the baseline automated coverage for every audit.
- **Limitations:** does not simulate assistive technologies; does not establish WCAG conformance; manual review remains necessary for keyboard use, zoom, motion, and screen-reader behavior.

## keyboard

- Adds focus sequence observation, keyboard reachability heuristics, positive tabindex detection, and optional focus-trap detection in the initial state.
- Can capture focus evidence (for example `focus-sequence.json`) when enabled in profile options.
- **Limitations:** does not operate controls beyond focus traversal; modal focus traps during interaction are not fully covered.

Keyboard profile does not replace a complete manual keyboard accessibility review.

a11yst does not simulate screen readers.

## large-text

Profile ID: `large-text`.

- Applies **200% injected text scaling** (default `textScale: 2`).
- Compares layout against a default snapshot when `compareWithDefault: true`.
- Heuristics detect horizontal overflow, clipping, control truncation, and fixed-dimension containers.
- **Limitations:** uses injected scaling, not browser zoom; does not verify full 400% reflow; results are heuristics, not WCAG 1.4.4/1.4.10 certification.

Configurable options include `detectHorizontalOverflow`, `compareWithDefault`, and `overlapTolerancePx`.

## reduced-motion

- Emulates **`prefers-reduced-motion: reduce`** when `emulatePreference: true`.
- Inspects animations and compares motion against a default snapshot when configured.
- Heuristics flag infinite animations, unchanged motion, and smooth-scroll behavior.
- **Limitations:** cannot decide automatically whether remaining motion is essential; short decorative fades may remain.

## Profile configuration

Profiles may be simple strings or structured objects with profile-specific options. Defaults when omitted:

```typescript
profiles: [
  "default",
  {
    id: "keyboard",
    maxTabStops: 100,
    detectFocusTraps: true,
    captureFocusEvidence: true,
  },
  {
    id: "large-text",
    textScale: 2,
    detectHorizontalOverflow: true,
    compareWithDefault: true,
  },
  {
    id: "reduced-motion",
    emulatePreference: true,
    inspectAnimations: true,
    minimumSignificantDurationMs: 300,
    compareWithDefault: true,
  },
]
```

Flows may override project profiles with their own `profiles` and `viewports` arrays.

Runnable fixtures: [examples/profiles](../examples/profiles/).

## Findings and evidence

Findings include `source: "axe" | "a11yst"`, `confidence`, and `automation` (`automated`, `heuristic`, or `manual-review`). Rule metadata may cite related standards without claiming full criterion coverage.

Evidence is organized under `evidence/<project>/<route>/<profile>/<viewport>/` with optional structured files such as `focus-sequence.json`, `layout-comparison.json`, and `motion-comparison.json`.

## Next steps

- [Flows](./flows.md) — audit interactive states with checkpoints
- [Configuration](./configuration.md) — combine profiles with routes and viewports
- [Reports](./reports.md) — how profile coverage appears in output
