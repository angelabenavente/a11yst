import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, meetsContrast } from "../../helpers/brand/contrast.js";
import { getRepoRoot } from "../../helpers/release/workspace-packages.js";

type ThemeTokens = {
  text: string;
  textMuted: string;
  background: string;
  accent: string;
  accentContrast: string;
  focus: string;
  severity: Record<string, string>;
};

async function loadTheme(theme: "light" | "dark"): Promise<ThemeTokens> {
  const raw = await readFile(join(getRepoRoot(), "assets/brand/tokens.json"), "utf8");
  const tokens = JSON.parse(raw) as { color: Record<"light" | "dark", ThemeTokens> };
  return tokens.color[theme];
}

describe("brand token contrast", () => {
  it("meets WCAG AA for primary text on background (light and dark)", async () => {
    for (const theme of ["light", "dark"] as const) {
      const colors = await loadTheme(theme);
      expect(meetsContrast(colors.text, colors.background, 4.5)).toBe(true);
      expect(meetsContrast(colors.textMuted, colors.background, 4.5)).toBe(true);
    }
  });

  it("meets WCAG AA for accent contrast pair", async () => {
    for (const theme of ["light", "dark"] as const) {
      const colors = await loadTheme(theme);
      expect(meetsContrast(colors.accentContrast, colors.accent, 4.5)).toBe(true);
    }
  });

  it("meets WCAG AA for focus indicator on surface backgrounds", async () => {
    for (const theme of ["light", "dark"] as const) {
      const colors = await loadTheme(theme);
      expect(meetsContrast(colors.focus, colors.background, 3)).toBe(true);
    }
  });

  it("keeps severity text readable on background (light theme)", async () => {
    const colors = await loadTheme("light");
    for (const severity of Object.values(colors.severity)) {
      expect(contrastRatio(severity, colors.background)).toBeGreaterThan(3);
    }
  });

  it("documents contrast results for audit trail", async () => {
    const light = await loadTheme("light");
    const ratio = contrastRatio(light.text, light.background);
    expect(ratio).toBeGreaterThan(10);
  });
});
