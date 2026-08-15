import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectProject, SUPPORT_LEVELS } from "@a11yst/detect";
import type { HostFramework } from "@a11yst/detect";
import { repoRoot } from "../../helpers/cli.js";

const fixturesRoot = join(repoRoot, "examples/detection");

function fixture(name: string): string {
  return join(fixturesRoot, name);
}

describe("@a11yst/detect detectFramework (via detectProject)", () => {
  const cases: Array<{ fixture: string; framework: HostFramework }> = [
    { fixture: "html", framework: "html" },
    { fixture: "react-vite", framework: "react" },
    { fixture: "next-app", framework: "next" },
    { fixture: "angular-app", framework: "angular" },
    { fixture: "vue-vite", framework: "vue" },
    { fixture: "nuxt-app", framework: "nuxt" },
    { fixture: "svelte-app", framework: "svelte" },
    { fixture: "sveltekit-app", framework: "sveltekit" },
    { fixture: "astro-react", framework: "astro" },
    { fixture: "preact-app", framework: "preact" },
    { fixture: "solid-app", framework: "solid" },
    { fixture: "qwik-app", framework: "qwik" },
    { fixture: "ember-app", framework: "ember" },
    { fixture: "lit-app", framework: "lit" },
  ];

  for (const { fixture: fixtureName, framework } of cases) {
    it(`detects "${framework}" for examples/detection/${fixtureName}`, async () => {
      const result = await detectProject({ cwd: fixture(fixtureName) });
      expect(result.project.framework.framework).toBe(framework);
      expect(result.project.framework.evidence.length).toBeGreaterThan(0);
      expect(result.project.framework.supportLevel).toBe(SUPPORT_LEVELS[framework]);
    });
  }

  it('detects "unknown" for an empty project', async () => {
    const result = await detectProject({ cwd: fixture("unknown-empty") });
    expect(result.project.framework.framework).toBe("unknown");
    expect(result.project.framework.confidence).toBe("unknown");
    expect(result.project.framework.evidence).toHaveLength(0);
    expect(result.project.framework.supportLevel).toBe(SUPPORT_LEVELS.unknown);
    expect(
      result.project.framework.diagnostics.some((d) => d.code === "FRAMEWORK_UNKNOWN"),
    ).toBe(true);
  });

  it("prefers next over react (meta-framework beats the library it's built on)", async () => {
    const result = await detectProject({ cwd: fixture("next-app") });
    expect(result.project.framework.framework).toBe("next");
    expect(result.project.framework.alternatives.some((a) => a.framework === "react")).toBe(
      true,
    );
  });

  it("prefers nuxt over vue", async () => {
    const result = await detectProject({ cwd: fixture("nuxt-app") });
    expect(result.project.framework.framework).toBe("nuxt");
    expect(result.project.framework.alternatives.some((a) => a.framework === "vue")).toBe(true);
  });

  it("prefers sveltekit over svelte", async () => {
    const result = await detectProject({ cwd: fixture("sveltekit-app") });
    expect(result.project.framework.framework).toBe("sveltekit");
    expect(result.project.framework.alternatives.some((a) => a.framework === "svelte")).toBe(
      true,
    );
  });

  it("prefers astro over the react island it hosts", async () => {
    const result = await detectProject({ cwd: fixture("astro-react") });
    expect(result.project.framework.framework).toBe("astro");
    expect(result.project.framework.framework).not.toBe("react");
    expect(result.project.framework.alternatives.some((a) => a.framework === "react")).toBe(
      true,
    );
  });

  it("surfaces ambiguity with an alternative and a diagnostic or reduced confidence", async () => {
    const result = await detectProject({ cwd: fixture("ambiguous") });
    const framework = result.project.framework;

    // Deterministic priority pick, whichever the current HOST_PRIORITY order selects.
    expect(["next", "astro"]).toContain(framework.framework);
    expect(framework.alternatives.length).toBeGreaterThan(0);

    const hasAmbiguityDiagnostic = framework.diagnostics.some(
      (d) => d.code === "FRAMEWORK_AMBIGUOUS",
    );
    const hasLowConfidence = framework.confidence === "medium" || framework.confidence === "low";
    expect(hasAmbiguityDiagnostic || hasLowConfidence).toBe(true);
  });

  it("produces deterministic results across repeated calls", async () => {
    const [a, b] = await Promise.all([
      detectProject({ cwd: fixture("next-app") }),
      detectProject({ cwd: fixture("next-app") }),
    ]);

    expect(a.project.framework.framework).toEqual(b.project.framework.framework);
    expect(a.project.framework.score).toEqual(b.project.framework.score);
    expect(a.project.framework.evidence).toEqual(b.project.framework.evidence);
    expect(a.project.framework.alternatives).toEqual(b.project.framework.alternatives);
  });

  it("every SUPPORT_LEVELS entry is a valid supportLevel value", () => {
    const validLevels = new Set([
      "first-class",
      "preview",
      "runtime-compatible",
      "beta",
      "unknown",
    ]);
    for (const level of Object.values(SUPPORT_LEVELS)) {
      expect(validLevels.has(level)).toBe(true);
    }
  });
});
