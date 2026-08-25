# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning.

## Unreleased

## [1.0.2] - 2026-08-24

### Changed

- Package README badges (npm version, MPL-2.0 license, total downloads) and `homepage` metadata now point to https://www.a11yst.dev.

## [1.0.1] - 2026-08-23

### Fixed

- `@a11yst/cli` now depends on Playwright and exposes the `playwright` binary so `pnpm exec playwright install chromium` works in consumer projects (pnpm does not expose transitive bins). `a11yst doctor` checks that Chromium is installed.

## [1.0.0] - 2026-08-23

### Added

- Multi-package CLI distribution (`@a11yst/cli` consumer entry) with Playwright + axe audits, profiles, flows, baseline comparison, source analysis, recommendations, and multiple report formats.
- Local packaging and external consumer-install validation from release tarballs.

### Changed

- Renamed the project from Allyst to a11yst before the first public release.
- Formal release documentation, security policy, and contribution guidance prepared for the release gate.
- Licensed a11yst Community under MPL-2.0.

Automated accessibility testing does not establish WCAG conformance and does not replace manual accessibility testing.
