import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getRepoRoot } from "../../helpers/release/workspace-packages.js";

async function readRootDoc(filename: string): Promise<string> {
  return readFile(join(getRepoRoot(), filename), "utf8");
}

describe("licensing documentation contracts", () => {
  it("documents MPL-2.0 and npm installation in README", async () => {
    const readme = await readRootDoc("README.md");
    expect(readme).toContain("MPL-2.0");
    expect(readme).toContain("Mozilla Public License 2.0");
    expect(readme).not.toMatch(/non-commercial|source-available only|commercial use prohibited/i);
    expect(readme).toContain("pnpm add -D @a11yst/cli");
  });

  it("includes docs/licensing.md with Community MPL guidance", async () => {
    const licensing = await readFile(join(getRepoRoot(), "docs/licensing.md"), "utf8");
    expect(licensing).toContain("MPL-2.0");
    expect(licensing).toContain("commercial");
    expect(licensing).toContain("LICENSE");
    expect(licensing).not.toMatch(/commercial use prohibited|non-commercial only/i);
  });

  it("includes CLI README license wording for tarball consumers", async () => {
    const cliReadme = await readFile(join(getRepoRoot(), "packages/cli/README.md"), "utf8");
    expect(cliReadme).toContain("MPL-2.0");
    expect(cliReadme).toContain("LICENSE file included with this package");
    expect(cliReadme).toContain("pnpm add -D @a11yst/cli");
  });

  it("includes NOTICE.md without invented copyright holder or mandatory marketing credit", async () => {
    const notice = await readRootDoc("NOTICE.md");
    expect(notice).toContain("Mozilla Public License 2.0");
    expect(notice).toContain("LICENSE");
    expect(notice).not.toMatch(/Copyright ©|copyright \(c\)/i);
    expect(notice).not.toMatch(/Powered by a11yst|mandatory credit|must credit/i);
  });

  it("includes TRADEMARKS.md separating code license from branding", async () => {
    const trademarks = await readRootDoc("TRADEMARKS.md");
    expect(trademarks).toMatch(/code license|source code/i);
    expect(trademarks).toMatch(/brand|project name|branding/i);
    expect(trademarks).toMatch(/Based on a11yst|uses a11yst/i);
    expect(trademarks).not.toMatch(/commercial use prohibited|may not sell/i);
    expect(trademarks).not.toContain("®");
    expect(trademarks).toMatch(/does not claim that a11yst is a registered trademark/i);
  });

  it("keeps root and package LICENSE files byte-identical", async () => {
    const repoRoot = getRepoRoot();
    const root = await readFile(join(repoRoot, "LICENSE"), "utf8");
    const packageLicense = await readFile(join(repoRoot, "packages/cli/LICENSE"), "utf8");
    const rootHash = createHash("sha256").update(root).digest("hex");
    const packageHash = createHash("sha256").update(packageLicense).digest("hex");
    expect(packageHash).toBe(rootHash);
  });
});
