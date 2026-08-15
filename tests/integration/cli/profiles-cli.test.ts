import { describe, expect, it } from "vitest";
import { runCli } from "../../helpers/cli.js";

const FAST_COMMAND_CEILING_MS = 5_000;

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, elapsedMs: Date.now() - start };
}

describe.sequential("profiles CLI integration", () => {
  it("profiles emits human-readable output", async () => {
    const { result, elapsedMs } = await timed(() => runCli(["profiles"]));

    expect(result.code).toBe(0);
    expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);
    expect(result.stdout).toContain("Accessibility profiles");
    expect(result.stdout).toContain("KEYBOARD");
    expect(result.stdout).toContain("LARGE-TEXT");
    expect(result.stdout).toContain("REDUCED-MOTION");
    expect(result.stdout).toContain("a11yst does not certify WCAG conformance.");
    expect(() => JSON.parse(result.stdout)).toThrow();
  });

  it("profiles --json lists built-in profiles with coverage metadata", async () => {
    const { result, elapsedMs } = await timed(() => runCli(["profiles", "--json"]));

    expect(result.code).toBe(0);
    expect(elapsedMs).toBeLessThan(FAST_COMMAND_CEILING_MS);

    const payload = JSON.parse(result.stdout) as {
      profiles: Array<{
        id: string;
        webImplemented: boolean;
        capabilities: string[];
        coverage: {
          automatedChecks: string[];
          heuristicChecks: string[];
          manualChecks: string[];
          limitations: string[];
        };
      }>;
    };

    expect(payload.profiles.map((profile) => profile.id)).toEqual([
      "default",
      "keyboard",
      "large-text",
      "reduced-motion",
    ]);
    expect(payload.profiles.every((profile) => profile.webImplemented)).toBe(true);
    expect(payload.profiles.find((profile) => profile.id === "keyboard")?.capabilities).toContain(
      "keyboard-navigation",
    );
    expect(
      payload.profiles.find((profile) => profile.id === "reduced-motion")?.coverage.limitations
        .length,
    ).toBeGreaterThan(0);
  });
});
