import { describe, expect, it } from "vitest";
import { productIdentity } from "@a11yst/types";
import {
  createBrandHeader,
  createPlainBrandHeader,
} from "../../../../packages/cli/src/presentation/brand-header.js";

const LEGACY_MASCOT_MARKERS = ["Ally", " /\\", " /__\\", "Always by your side."] as const;

describe("createBrandHeader", () => {
  it("uses productIdentity for display name and primary tagline", () => {
    const header = createPlainBrandHeader();
    expect(header).toContain(productIdentity.displayName);
    expect(header).toContain(productIdentity.tagline);
    expect(productIdentity.displayName).toBe("a11yst");
  });

  it("renders a minimal canonical header", () => {
    const header = createPlainBrandHeader();
    expect(header).toBe("a11yst\nYour accessibility analyst.");
    for (const marker of LEGACY_MASCOT_MARKERS) {
      expect(header).not.toContain(marker);
    }
    // eslint-disable-next-line no-control-regex
    expect(header).not.toMatch(/\x1b\[[0-9;]*m/);
  });

  it("renders the same identity for interactive mode", () => {
    const header = createBrandHeader({ mode: "interactive", tagline: true });
    expect(header).toBe("a11yst\nYour accessibility analyst.");
    for (const marker of LEGACY_MASCOT_MARKERS) {
      expect(header).not.toContain(marker);
    }
  });

  it("omits tagline when tagline is false", () => {
    const header = createPlainBrandHeader({ tagline: false });
    expect(header).toBe("a11yst");
  });

  it("does not include dynamic environment data", () => {
    const header = createBrandHeader({ mode: "interactive", tagline: true });
    expect(header).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(header).not.toMatch(/localhost|127\.0\.0\.1/);
    expect(header).not.toMatch(/\/Users\//);
  });
});
