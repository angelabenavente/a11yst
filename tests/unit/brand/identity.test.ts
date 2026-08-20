import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { productIdentity } from "@a11yst/types";
import {
  BRAND_ASSET_DIR,
  CANONICAL_SEVERITIES,
  DEPRECATED_SEVERITY_LABELS,
} from "../../helpers/brand/constants.js";
import { getRepoRoot } from "../../helpers/release/workspace-packages.js";

describe("brand identity contract", () => {
  it("matches canonical product identity from @a11yst/types", () => {
    expect(productIdentity.productName).toBe("a11yst");
    expect(productIdentity.displayName).toBe("a11yst");
    expect(productIdentity.cliName).toBe("a11yst");
    expect(productIdentity.tagline).toBe("Your accessibility analyst.");
    expect("mascotName" in productIdentity).toBe(false);
    expect("supportingLine" in productIdentity).toBe(false);
  });

  it("documents brand assets without website/MkDocs claims", async () => {
    const brandGuide = await readFile(join(getRepoRoot(), "assets/brand/README.md"), "utf8");
    expect(brandGuide).toContain("Your accessibility analyst.");
    expect(brandGuide).toContain("TRADEMARKS.md");
    expect(brandGuide).not.toMatch(/MkDocs|website:dev/i);
    expect(brandGuide).not.toMatch(/registered trademark|trademark cleared worldwide/i);
  });

  it("does not use legacy identity as current branding in brand assets", async () => {
    const brandGuide = await readFile(join(getRepoRoot(), "assets/brand/README.md"), "utf8");
    expect(brandGuide).not.toMatch(/\bAlly\b/);
    expect(brandGuide).toMatch(/Do not use as primary identity:[\s\S]*Always by your side\./);
    expect(brandGuide).toMatch(/Mascot \| none/i);
  });
});

describe("brand tokens contract", () => {
  it("defines light and dark severity tokens with canonical labels only", async () => {
    const raw = await readFile(join(getRepoRoot(), BRAND_ASSET_DIR, "tokens.json"), "utf8");
    const tokens = JSON.parse(raw) as {
      severityLabels: string[];
      color: { light: { severity: Record<string, string> }; dark: { severity: Record<string, string> } };
    };
    expect(tokens.severityLabels).toEqual([...CANONICAL_SEVERITIES]);
    for (const label of DEPRECATED_SEVERITY_LABELS) {
      expect(tokens.severityLabels).not.toContain(label);
    }
    for (const theme of ["light", "dark"] as const) {
      for (const severity of CANONICAL_SEVERITIES) {
        expect(tokens.color[theme].severity[severity]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
