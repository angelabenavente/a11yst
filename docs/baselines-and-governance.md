# Baselines and governance

A **baseline** is a versioned JSON file recording known accessibility findings so later audits can distinguish new work from known debt, surface regressions, and list resolved items.

> A baseline records known accessibility debt. It does not make that debt accessible or compliant.

## Fingerprints

Each finding carries a deterministic **fingerprint** (`fingerprintVersion: "1"`) built from rule, project, location (route or flow checkpoint), profile, viewport, and target. Baseline entries store the same fingerprint.

Matching is exact within a fingerprint version. Fingerprints are designed for comparison; future schema migrations may introduce new versions with explicit migration paths.

## Lifecycle statuses

| Status | Meaning |
| --- | --- |
| `new` | Present in the audit, absent from the baseline |
| `known` | Present in both; severity unchanged (may carry a classification) |
| `regressed` | Known finding worsened, returned after resolution, or classification expired |
| `resolved` | In the baseline but not found in the current audit |
| `not-compared` | In the baseline but outside current audit coverage |

Regressions are detected when, among other cases:

- severity increases on a known finding;
- an accepted classification’s `expiresAt` or `reviewAt` date has passed;
- a previously resolved finding reappears.

Comparison is coverage-sensitive: partial route lists, `--flows-only`, skipped projects, or changed viewports produce **not-compared** entries, not false resolutions.

## Baseline configuration

```typescript
baseline: {
  file: ".a11yst/baseline.json",
  compare: true,
  classifications: true,
},
```

When `compare` is enabled and the file exists, audits enrich findings with lifecycle metadata and may write `baseline-comparison.json` into the run bundle.

## Commands

```bash
# Create from latest (or explicit) results
pnpm a11yst baseline create
pnpm a11yst baseline create --from .a11yst/results/runs/<auditId>/results.json --force

# Inspect status
pnpm a11yst baseline status
pnpm a11yst baseline status --json

# Preview or apply maintenance
pnpm a11yst baseline update --dry-run --accept-new
pnpm a11yst baseline update --accept-new --remove-resolved --yes

# Migrate schema version
pnpm a11yst baseline migrate --dry-run
pnpm a11yst baseline migrate --yes
```

Audit integration:

```bash
pnpm a11yst audit --no-baseline
pnpm a11yst audit --baseline ".a11yst/custom-baseline.json"
pnpm a11yst audit --create-baseline --force
```

List findings with lifecycle labels:

```bash
pnpm a11yst findings --status new
pnpm a11yst findings --disposition accepted-risk --json
```

Destructive operations (`update`, `classify`, `unclassify`, `migrate`) preview changes and exit `2` until you confirm with `--yes`.

## Classifications

Classifications document why known debt is tracked. Supported dispositions:

| Disposition | Typical use | Required metadata |
| --- | --- | --- |
| `false-positive` | Finding invalid in context | `reason` |
| `accepted-risk` | Known debt with planned remediation | `reason`, `owner`, `expiresAt` |
| `third-party` | External component limitation | `reason`, `owner`, `expiresAt` or `reviewAt` |
| `not-applicable` | Rule does not apply | `reason` |
| `manual-review` | Needs human confirmation | `reason` |

Classify or remove a classification:

```bash
pnpm a11yst classify <finding-id> --disposition false-positive --reason "Decorative icon"
pnpm a11yst classify <finding-id> --disposition accepted-risk \
  --reason "Q4 remediation" --owner platform-team --expires 2026-12-31 --yes
pnpm a11yst unclassify <finding-id> --yes
```

`<finding-id>` resolves by exact id, full fingerprint, or unique prefix.

### Metadata fields

| Field | Purpose |
| --- | --- |
| `reason` | Why the classification applies |
| `owner` | Team or person accountable |
| `ticket` | Tracking ticket id |
| `expiresAt` | Expiry date (`YYYY-MM-DD`) for time-bound acceptances |
| `reviewAt` | Review date (`YYYY-MM-DD`) for third-party items |
| `notes` | Additional context |
| `createdBy` | Author (stored when provided by tooling) |
| `createdAt` | Timestamp (set automatically) |

### Expiry and review

- **`expiresAt`** — after this date, an accepted-risk classification expires and the finding may **regress** with reason `classification-expired`.
- **`reviewAt`** — used for third-party classifications; when passed without renewal, the classification expires similarly.

Classifying a finding does not make the accessibility barrier disappear. A classification represents a governance decision, not a fix.

You cannot classify a current finding as `resolved`; resolution happens only when the finding no longer appears in an audit.

## Policy

CI **policy** evaluates findings together with lifecycle and classification state:

```text
findings + lifecycle + classification → policy evaluation → exit code
```

Configuration options:

| Option | Default |
| --- | --- |
| `failOnNew` | `false` |
| `failOnRegression` | `false` |
| `failOnExpiredClassification` | `false` |
| `minimumSeverity` | `high` |

CLI flags (`--fail-on-new`, `--fail-on-regression`, `--fail-on-expired-classification`, `--minimum-severity`) override config for a single run.

`false-positive` and `not-applicable` classifications are excluded from policy breaches. Policy requires baseline comparison when enabled.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Audit completed; policy disabled or passed |
| `1` | Operational/config error, incomplete audit, or policy could not be evaluated |
| `2` | Audit completed; configured CI policy failed |

Findings alone do not force exit `1`. See [CI](./ci.md) for pipeline setup.

## Git workflow

Typical team workflow:

1. Run audits locally or in CI.
2. Create or update `.a11yst/baseline.json` when the team agrees on known debt.
3. Commit the baseline file to version control.
4. Keep `.a11yst/results/` out of git unless you archive bundles deliberately.

## Next steps

- [CI](./ci.md) — policy in pipelines
- [Source analysis](./source-analysis.md) — map findings to source
- [Reports](./reports.md) — baseline sections in HTML output
