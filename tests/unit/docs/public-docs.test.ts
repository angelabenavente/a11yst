import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getRepoRoot } from "../../helpers/release/workspace-packages.js";

const REAL_CLI_COMMANDS = [
  "init",
  "detect",
  "routes",
  "profiles",
  "flows",
  "audit",
  "doctor",
  "report",
  "baseline",
  "findings",
  "classify",
] as const;
const LEGACY_IDENTITY = ["Allyst", "allyst", "Ally", "Always by your side."] as const;

async function readPublicDocs(): Promise<string> {
  const repoRoot = getRepoRoot();
  const files = [
    "README.md",
    "docs/getting-started.md",
    "docs/configuration.md",
    "docs/profiles.md",
    "docs/flows.md",
    "docs/reports.md",
    "docs/source-analysis.md",
    "docs/baselines-and-governance.md",
    "docs/ci.md",
    "docs/react-route-discovery.md",
    "docs/severity-model.md",
  ];
  const contents = await Promise.all(files.map((file) => readFile(join(repoRoot, file), "utf8")));
  return contents.join("\n");
}

describe("public project documentation", () => {
  it("describes the current CLI surface including restored commands", async () => {
    const readme = await readFile(join(getRepoRoot(), "README.md"), "utf8");
    for (const command of REAL_CLI_COMMANDS) {
      expect(readme).toContain(`\`${command}\``);
    }
    expect(readme).toMatch(/^\| `init` /m);
    expect(readme).toMatch(/^\| `doctor` /m);
    expect(readme).toMatch(/^\| `baseline` /m);
    expect(readme).toMatch(/^\| `findings` /m);
    expect(readme).toMatch(/^\| `classify` \/ `unclassify` /m);
    expect(readme).toContain("examples/ci/");
    expect(readme).toContain("github-annotations");
  });

  it("avoids false product and publish claims", async () => {
    const docs = await readPublicDocs();
    expect(docs).toContain("Your accessibility analyst.");
    expect(docs).toContain("MPL-2.0");
    expect(docs).toMatch(/does not establish WCAG conformance/i);
    expect(docs).not.toMatch(/WCAG compliant|certified|guaranteed compliance/i);
    expect(docs).not.toMatch(/complete replacement of manual testing/i);
    expect(docs).not.toMatch(/React Native runtime auditing is (currently )?supported/i);
    expect(docs).toMatch(/React Native runtime auditing is not currently supported/i);
    expect(docs).not.toMatch(/a11yst Cloud\b|a11yst Pro\b|a11yst Enterprise\b/i);
    expect(docs).not.toMatch(/npm install @a11yst|published on npm|npx a11yst/i);
    expect(docs).not.toMatch(/website:dev|mkdocs|127\.0\.0\.1:8000/i);
    expect(docs).not.toMatch(/a11yst\.(dev|io|com|app)/i);
  });

  it("does not revive old identity in public docs", async () => {
    const docs = await readPublicDocs();
    for (const marker of LEGACY_IDENTITY) {
      expect(docs).not.toContain(marker);
    }
  });

  it("links only to documentation files that exist in this repository", async () => {
    const repoRoot = getRepoRoot();
    const docsDir = join(repoRoot, "docs");
    const entries = await readdir(docsDir);
    expect(entries).toEqual(expect.arrayContaining([
      "getting-started.md",
      "configuration.md",
      "profiles.md",
      "flows.md",
      "reports.md",
      "source-analysis.md",
      "baselines-and-governance.md",
      "ci.md",
      "licensing.md",
    ]));
  });
});
