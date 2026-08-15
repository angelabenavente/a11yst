import { productIdentity } from "@a11yst/types";
import type { BrandHeaderOptions } from "./types.js";

function renderIdentityLines(includeTagline: boolean): string[] {
  const lines: string[] = [productIdentity.displayName];
  if (includeTagline) {
    lines.push(productIdentity.tagline);
  }
  return lines;
}

/** Plain brand header: product name and optional primary tagline. */
export function createPlainBrandHeader(options: Pick<BrandHeaderOptions, "tagline"> = {}): string {
  const includeTagline = options.tagline !== false;
  return renderIdentityLines(includeTagline).join("\n");
}

/** Human brand header for interactive and plain terminal modes. */
export function createBrandHeader(options: BrandHeaderOptions = { mode: "plain" }): string {
  return createPlainBrandHeader({ tagline: options.tagline });
}
