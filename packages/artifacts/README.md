# `@a11yst/artifacts`

Safe, portable persistence for a11yst audit bundles.

## Public API

- `createArtifactWriter(options)` / `ArtifactWriter` create a
  `runs/<auditId>/` bundle, write JSON/binary evidence/report assets, finalize
  `manifest.json` and `results.json`, and atomically update `latest.json`.
- `createAuditId(options)` creates a timestamp-plus-entropy bundle ID.
  Supplying deterministic time/entropy is intended for tests only.
- `sanitizePathSegment(value, options)` creates a portable path segment.
- `stableStringify(value)` serializes supported JSON values with stable key
  ordering and a trailing newline.

The audit ID identifies one persisted bundle. It is not a run ID or finding ID.
Manifest and result paths are bundle-relative; `latest.json` paths are relative
to the output root.

## Security and privacy

The writer rejects absolute/traversing/non-portable bundle paths and existing
symbolic links, verifies writes remain below the artifact root, uses atomic
temporary-file replacement, and creates written files with owner-only
permissions where supported. These controls do not make captured content safe
to publish.

Screenshots and serialized HTML snippets can contain visible or sensitive data.
Callers must protect `outputDir`, avoid unreviewed publication, and choose their
own retention and ignore-file policy. The package does not upload artifacts or
modify a user's `.gitignore`.

## Accessibility scope

This package stores evidence; it does not analyze accessibility or establish
conformance.

a11yst does not certify WCAG conformance.

Automated checks cover only part of accessibility.

Manual review and testing with disabled users remain necessary.
