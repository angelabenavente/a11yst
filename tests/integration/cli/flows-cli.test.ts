import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot, runCli } from "../../helpers/cli.js";

const EXAMPLES = [
  "examples/flows/html-dialog",
  "examples/flows/react-checkout",
] as const;

describe("CLI flows command (no browser)", () => {
  for (const example of EXAMPLES) {
    it(`lists flows for ${example}`, async () => {
      const result = await runCli(["flows", "--cwd", join(repoRoot, example)]);
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/Flow|Steps|Start|Profiles/i);
      expect(result.stderr).toBe("");
    });
  }

  it("outputs JSON for react-checkout flows", async () => {
    const result = await runCli(["flows", "--json", "--cwd", join(repoRoot, "examples/flows/react-checkout")]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      projects: Array<{ name: string; flows: Array<{ id: string }> }>;
    };
    expect(payload.projects[0]?.flows.map((flow) => flow.id)).toContain("open-cart");
  });

  it("filters by --project", async () => {
    const result = await runCli([
      "flows",
      "--cwd",
      join(repoRoot, "examples/flows/html-dialog"),
      "--project",
      "flows-html-dialog",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("flows-html-dialog");
    expect(result.stdout).toContain("dialog-accessible");
  });

  it("exits 1 for unknown project", async () => {
    const result = await runCli([
      "flows",
      "--cwd",
      join(repoRoot, "examples/flows/html-dialog"),
      "--project",
      "missing-project",
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/Unknown project/i);
  });

  it("completes quickly without starting a dev server", async () => {
    const started = Date.now();
    const result = await runCli(["flows", "--cwd", join(repoRoot, "examples/flows/html-dialog")]);
    expect(result.code).toBe(0);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
