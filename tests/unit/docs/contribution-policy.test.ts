import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getRepoRoot } from "../../helpers/release/workspace-packages.js";

async function readRootDoc(filename: string): Promise<string> {
  return readFile(join(getRepoRoot(), filename), "utf8");
}

async function readDoc(relativePath: string): Promise<string> {
  return readFile(join(getRepoRoot(), relativePath), "utf8");
}

describe("contribution policy documentation contracts", () => {
  it("includes CONTRIBUTING with PRs welcome and merge gated on CLA", async () => {
    const contributing = await readRootDoc("CONTRIBUTING.md");
    expect(contributing).toContain("Ways to contribute");
    expect(contributing).toMatch(/Report bugs|Suggest features|Improve documentation|Submit pull requests|Contribute code/i);
    expect(contributing).toContain("Merge requirements");
    expect(contributing).toMatch(/pull requests are welcome|External pull requests are welcome/i);
    expect(contributing).toMatch(/cannot be merged|cannot be merged until/i);
    expect(contributing).toContain("Contributor License Agreement");
    expect(contributing).toContain("MPL-2.0");
    expect(contributing).toMatch(/constitute CLA acceptance|bind you to any CLA|No contributor license agreement is active/i);
    expect(contributing).not.toMatch(
      /should not be submitted yet|do not submit external code pull requests|pull requests.*not accepted/i,
    );
    expect(contributing).not.toMatch(/copyright assignment|assign all rights|we own your contribution/i);
    expect(contributing).not.toMatch(/by submitting.*agree.*CLA|CLA is active|CLA Assistant is active/i);
  });

  it("includes README welcoming PRs with temporary merge gate", async () => {
    const readme = await readRootDoc("README.md");
    expect(readme).toMatch(/pull requests are welcome|documentation improvements.*pull requests/i);
    expect(readme).toMatch(/reviewed but cannot be merged|cannot be merged/i);
    expect(readme).toContain("CONTRIBUTING.md");
    expect(readme).toContain("docs/contributing-ip.md");
    expect(readme).not.toMatch(/RECEIVING PARTY TO BE CONFIRMED|\[RECEIVING PARTY/i);
    expect(readme).not.toMatch(/external code contributions.*paused|not yet accepting external code/i);
  });

  it("includes contributor IP guide with ownership and commercial transparency", async () => {
    const guide = await readDoc("docs/contributing-ip.md");
    expect(guide).toContain("MPL-2.0");
    expect(guide).toMatch(/retains ownership|not be required to assign copyright/i);
    expect(guide).toMatch(/separately licensed commercial|future commercial offerings/i);
    expect(guide).toMatch(/pull requests are welcome|External pull requests are welcome/i);
    expect(guide).toMatch(/cannot be merged|merge.*gated|merge remains gated/i);
    expect(guide).toMatch(/do not agree to any a11yst CLA/i);
    expect(guide).not.toMatch(/a11yst owns your contribution|commercial use prohibited|non-commercial only/i);
    expect(guide).not.toMatch(/external code contributions are not currently accepted for merge/i);
    expect(guide).toMatch(/DCO.*not selected|not selected.*DCO/i);
  });

  it("includes governance with open/reviewable/mergeable states", async () => {
    const governance = await readDoc("docs/contribution-governance.md");
    expect(governance).toMatch(/Pull requests welcome|pull requests.*welcome|Code pull requests.*welcome/i);
    expect(governance).toMatch(/Open|Reviewable|Mergeable/i);
    expect(governance).toMatch(/blocked until active CLA|cannot be merged|merge allowed.*no/i);
    expect(governance).toMatch(/CLA approval alone does not|CLA approval.*separate/i);
    expect(governance).toMatch(/do \*\*not\*\* block the first public package release|do not block the first public package release/i);
  });

  it("includes draft CLA and CCLA marked NOT ACTIVE with legal review markers", async () => {
    const icla = await readDoc("docs/legal/CLA-DRAFT.md");
    const ccla = await readDoc("docs/legal/CCLA-DRAFT.md");
    const checklist = await readDoc("docs/legal/CLA-REVIEW-CHECKLIST.md");

    for (const draft of [icla, ccla]) {
      expect(draft).toMatch(/DRAFT.*NOT ACTIVE|NOT ACTIVE/i);
      expect(draft).toMatch(/LEGAL REVIEW REQUIRED/i);
      expect(draft).toContain("[RECEIVING PARTY TO BE CONFIRMED BEFORE ACTIVATION]");
      expect(draft).not.toMatch(/By submitting a pull request you agree/i);
    }

    expect(checklist).toContain("Receiving party legal identity");
    expect(checklist).toMatch(/Pull requests may be opened before activation/i);
    expect(checklist).toMatch(/CLA check must become a required merge gate/i);
    expect(checklist).toMatch(/NOT ACTIVE/i);
  });

  it("updates licensing doc to distinguish MPL from future CLA rights", async () => {
    const licensing = await readDoc("docs/licensing.md");
    expect(licensing).toMatch(/Contributions|contributor agreement/i);
    expect(licensing).toContain("MPL-2.0");
    expect(licensing).not.toMatch(/grant maintainers unlimited rights to relicense all contributions/i);
  });

  it("includes PR template welcoming contributions with temporary merge gate", async () => {
    const template = await readDoc(".github/pull_request_template.md");
    expect(template).toMatch(/Pull requests are welcome|welcome/i);
    expect(template).toMatch(/require the project's CLA before merge once the CLA workflow is activated/i);
    expect(template).toMatch(/third-party material/i);
    expect(template).toMatch(/confidential information/i);
    expect(template).toMatch(/cannot be merged|cannot be merged until/i);
    expect(template).toMatch(/CLA.*not active|not active yet/i);
    expect(template).toMatch(/separate from technical review/i);
    expect(template).not.toMatch(/I agree to the CLA|agree to the a11yst CLA/i);
  });

  it("does not track signed agreement or contributor PII paths", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const repoRoot = getRepoRoot();
    const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: repoRoot });
    const tracked = stdout.split("\n");
    expect(tracked.some((path) => path.includes("signed-cla/"))).toBe(false);
    expect(tracked.some((path) => path.endsWith("contributors.csv"))).toBe(false);
    expect(tracked.some((path) => path.includes("agreements/"))).toBe(false);
  });

  it("rejects forbidden contribution-policy wording regressions", async () => {
    const paths = [
      "CONTRIBUTING.md",
      "README.md",
      "docs/contributing-ip.md",
      "docs/contribution-governance.md",
      ".github/pull_request_template.md",
    ];
    const forbidden = [
      /external code contributions are not accepted/i,
      /pull requests are disabled/i,
      /signing the CLA guarantees merge/i,
      /opening a PR constitutes signing the CLA/i,
      /contributors assign copyright to a11yst/i,
    ];
    for (const relativePath of paths) {
      const content = await readDoc(relativePath);
      for (const pattern of forbidden) {
        expect(content, `${relativePath} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
