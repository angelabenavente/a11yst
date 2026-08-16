# Severity model

a11yst uses a **canonical four-level severity model** in all public contracts, reports, and CI policy:

| Canonical severity | User-facing label |
| --- | --- |
| `minor` | MINOR |
| `medium` | MEDIUM |
| `high` | HIGH |
| `critical` | CRITICAL |

Ordering (highest first): **critical > high > medium > minor**.

## axe-core mapping

axe-core reports `impact` values that differ from a11yst terminology. During normalization:

| axe impact | a11yst severity |
| --- | --- |
| `minor` | `minor` |
| `moderate` | `medium` |
| `serious` | `high` |
| `critical` | `critical` |

When axe omits or reports an unknown impact, a11yst defaults to **`medium`**.

## Provider impact preservation

Findings sourced from axe retain the raw provider value separately:

```json
{
  "severity": "high",
  "sourceImpact": "serious",
  "source": "axe"
}
```

`sourceImpact` is provider terminology — not the public a11yst severity label.

## Fingerprints

Finding fingerprints **do not include severity**. Mapping axe `serious` → `high` does not change fingerprint identity for the same DOM finding.

## CI policy

Policy thresholds use canonical severities only:

```ts
ci: {
  failOnNew: true,
  minimumSeverity: "high",
}
```

Inspect resolved severities with `a11yst audit --json` (`findings[].severity` and `summary.findingsBySeverity`).
