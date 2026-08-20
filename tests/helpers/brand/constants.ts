export const BRAND_ASSET_DIR = "assets/brand";

export const REQUIRED_BRAND_ASSETS = [
  "a11yst-symbol.svg",
  "a11yst-symbol-light.svg",
  "a11yst-symbol-monochrome.svg",
  "a11yst-wordmark.svg",
  "a11yst-wordmark-light.svg",
  "a11yst-lockup.svg",
  "a11yst-lockup-light.svg",
  "favicon.svg",
  "tokens.json",
  "tokens.css",
] as const;

export const FORBIDDEN_SVG_PATTERNS = [
  /<script[\s>]/i,
  /xlink:href\s*=\s*["']https?:/i,
  /href\s*=\s*["']https?:/i,
  /data:image\//i,
  /base64,/i,
  /@import/i,
  /fonts\.googleapis\.com/i,
] as const;

export const CANONICAL_SEVERITIES = ["minor", "medium", "high", "critical"] as const;

export const DEPRECATED_SEVERITY_LABELS = ["moderate", "serious"] as const;

export const LEGACY_IDENTITY_MARKERS = ["Ally", "Always by your side.", "mascotName"] as const;
