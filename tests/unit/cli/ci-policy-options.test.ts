import { describe, expect, it } from "vitest";
import { parseCiPolicyCliOptions } from "../../../packages/cli/src/ci-policy-options.js";

describe("parseCiPolicyCliOptions", () => {
  it("returns empty overrides when no flags are passed", () => {
    const parsed = parseCiPolicyCliOptions({}, ["node", "a11yst", "audit"]);
    expect(parsed.overrides).toEqual({});
    expect(parsed.explicitFlagsUsed).toBe(false);
  });

  it("parses positive and negative fail-on-new flags from argv", () => {
    expect(
      parseCiPolicyCliOptions({}, ["node", "a11yst", "audit", "--fail-on-new"]).overrides
        .failOnNew,
    ).toBe(true);
    expect(
      parseCiPolicyCliOptions({}, ["node", "a11yst", "audit", "--no-fail-on-new"]).overrides
        .failOnNew,
    ).toBe(false);
  });

  it("rejects contradictory fail-on-new flags", () => {
    expect(() =>
      parseCiPolicyCliOptions({}, [
        "node",
        "a11yst",
        "audit",
        "--fail-on-new",
        "--no-fail-on-new",
      ]),
    ).toThrow(/Cannot use --fail-on-new and --no-fail-on-new together/);
  });

  it("rejects invalid minimum severity", () => {
    expect(() =>
      parseCiPolicyCliOptions({ minimumSeverity: "serious" }, [
        "node",
        "a11yst",
        "audit",
      ]),
    ).toThrow(/Invalid --minimum-severity/);
  });

  it("accepts valid minimum severity", () => {
    const parsed = parseCiPolicyCliOptions(
      { minimumSeverity: "high" },
      ["node", "a11yst", "audit", "--minimum-severity", "high"],
    );
    expect(parsed.overrides.minimumSeverity).toBe("high");
    expect(parsed.explicitFlagsUsed).toBe(true);
  });
});
