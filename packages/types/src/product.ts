/**
 * Canonical product identity.
 *
 * Keep all user-facing product naming here so the domain model stays rename-safe.
 * Not user-configurable; consumed by CLI, reporters, and documentation.
 */
export const productMetadata = {
  /** User-facing product name (sentence case). */
  name: "a11yst",
  /** Banner / logo-style display name. */
  displayName: "a11yst",
  /** CLI binary and config file prefix (`a11yst.config.ts`). */
  command: "a11yst",
  /** Primary public tagline. */
  tagline: "Your accessibility analyst.",
  /** Semantic version exposed by the CLI. */
  version: "0.1.0",
  /** Minimum supported Node.js major.minor. */
  minNodeVersion: "20.0.0",
} as const;

/** Structured identity for documentation and downstream release phases. */
export const productIdentity = {
  productName: productMetadata.name,
  displayName: productMetadata.displayName,
  cliName: productMetadata.command,
  tagline: productMetadata.tagline,
} as const;

export type ProductMetadata = typeof productMetadata;
export type ProductIdentity = typeof productIdentity;
