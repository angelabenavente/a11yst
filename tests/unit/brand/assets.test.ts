import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRAND_ASSET_DIR,
  FORBIDDEN_SVG_PATTERNS,
  REQUIRED_BRAND_ASSETS,
} from "../../helpers/brand/constants.js";
import { getRepoRoot } from "../../helpers/release/workspace-packages.js";

const MAX_SVG_BYTES = 8_192;

describe("brand SVG assets", () => {
  for (const filename of REQUIRED_BRAND_ASSETS.filter((name) => name.endsWith(".svg"))) {
    it(`validates ${filename}`, async () => {
      const path = join(getRepoRoot(), BRAND_ASSET_DIR, filename);
      const [content, info] = await Promise.all([
        readFile(path, "utf8"),
        stat(path),
      ]);
      expect(info.size).toBeLessThanOrEqual(MAX_SVG_BYTES);
      expect(content).toContain('viewBox="');
      expect(content).toContain("<svg");
      for (const pattern of FORBIDDEN_SVG_PATTERNS) {
        expect(content, `${filename} must not match ${pattern}`).not.toMatch(pattern);
      }
    });
  }

  it("includes required non-SVG token files", async () => {
    for (const filename of ["tokens.json", "tokens.css"]) {
      const path = join(getRepoRoot(), BRAND_ASSET_DIR, filename);
      const info = await stat(path);
      expect(info.isFile()).toBe(true);
    }
  });

  it("uses simplified symbol in favicon without embedded wordmark text", async () => {
    const favicon = await readFile(join(getRepoRoot(), BRAND_ASSET_DIR, "favicon.svg"), "utf8");
    expect(favicon).not.toContain(">a11yst<");
    expect(favicon).toContain("viewBox=");
  });
});
