/**
 * Target runtime platform for an audit project.
 */
export type Platform = "web";

/**
 * Supported web frameworks. Prefer an explicit value when known;
 * use `"unknown"` when detection has not run yet or confidence is low.
 *
 * First-class: html, react, next, angular, vue, nuxt
 * Preview: svelte, sveltekit
 * Runtime-compatible: astro, preact, solid, qwik, ember, lit
 */
export type WebFramework =
  | "html"
  | "react"
  | "next"
  | "angular"
  | "vue"
  | "nuxt"
  | "svelte"
  | "sveltekit"
  | "astro"
  | "preact"
  | "solid"
  | "qwik"
  | "ember"
  | "lit"
  | "unknown";

/**
 * Accessibility profiles that can shape future audit behaviour.
 * Phase 1 only models the names; engines arrive in later phases.
 */
export type AccessibilityProfile =
  | "default"
  | "keyboard"
  | "large-text"
  | "reduced-motion";

/**
 * Canonical a11yst finding severity levels.
 */
export type Severity = "minor" | "medium" | "high" | "critical";

/**
 * Diagnostic severity for non-blocking planner/config messages.
 */
export type DiagnosticSeverity = "info" | "warning" | "error";

/**
 * How strongly a11yst trusts a detection result.
 */
export type DetectionConfidence =
  | "certain"
  | "high"
  | "medium"
  | "low"
  | "unknown";

/**
 * How deeply a11yst intends to support a detected framework.
 * Detection ≠ deep integration.
 */
export type SupportLevel =
  | "first-class"
  | "preview"
  | "runtime-compatible"
  | "unknown";

/**
 * Kind of signal that contributed to a detection decision.
 */
export type DetectionEvidenceType =
  | "dependency"
  | "devDependency"
  | "file"
  | "directory"
  | "package-script"
  | "configuration"
  | "workspace"
  | "fallback";

/**
 * Detected JavaScript package manager.
 */
export type PackageManagerName = "pnpm" | "npm" | "yarn" | "bun" | "unknown";

/**
 * Outcome of a single planned audit execution.
 */
export type AuditRunStatus = "completed" | "skipped" | "failed";

/**
 * Origin of a finding or rule evaluation.
 */
export type AuditSource = "axe" | "a11yst";

/**
 * Overall audit execution status for a workspace run.
 */
export type AuditExecutionStatus =
  | "completed"
  | "completed-with-errors"
  | "failed";
