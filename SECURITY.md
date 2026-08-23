# Security Policy

## Supported versions

Only the latest development line in this repository is evaluated for security fixes. No long-term support commitment exists yet.

| Version | Supported |
| --- | --- |
| `1.0.x` | yes |
| Earlier versions | no |

## Reporting a vulnerability

Do **not** disclose suspected security vulnerabilities in public issues, pull requests, or discussion threads.

Security reporting channel confirmed: GitHub private vulnerability reporting at https://github.com/angelabenavente/a11yst/security/advisories/new

Use that private advisory form to report suspected vulnerabilities. Include enough detail to reproduce the issue and the version or commit you tested. Reports will be reviewed as capacity allows. No response-time SLA is promised.

## Scope

Security reports relevant to a11yst include, but are not limited to:

- accidental secret exposure in results, reports, or diagnostics;
- unsafe path handling or repository-root leakage;
- command injection or unsafe shell invocation in the CLI;
- unexpected network behavior during audits or installs;
- package supply-chain or tarball integrity issues;
- orphaned browser or dev-server processes after failed audits.

Out of scope: accessibility findings in applications you audit with a11yst, unless they reveal a vulnerability in a11yst itself.

## Disclosure

a11yst does not guarantee coordinated disclosure timelines. If you report a vulnerability through the confirmed GitHub channel, include enough detail to reproduce the issue and the version or commit you tested.

Automated accessibility checks do not establish WCAG conformance and do not replace manual accessibility testing.
