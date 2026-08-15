import { describe, expect, it } from "vitest";
import { AUDIT_HELP_DISCLAIMER } from "../../../../packages/cli/src/presentation/disclaimers.js";
import {
  createBrandHeader,
  createPlainBrandHeader,
  formatHumanStatus,
} from "../../../../packages/cli/src/presentation/index.js";

describe("presentation accessibility", () => {
  it("plain and interactive headers expose the same essential identity", () => {
    const plain = createPlainBrandHeader();
    const interactive = createBrandHeader({ mode: "interactive", tagline: true });

    expect(plain).toBe("a11yst\nYour accessibility analyst.");
    expect(interactive).toBe(plain);
    expect(plain).not.toContain("Ally");
    expect(plain).not.toContain("Always by your side.");
  });

  it("status labels include text, not color-only meaning", () => {
    expect(formatHumanStatus("success", "Audit completed.")).toBe("Success: Audit completed.");
    expect(formatHumanStatus("error", "Configuration is invalid.")).toBe(
      "Error: Configuration is invalid.",
    );
    // eslint-disable-next-line no-control-regex
    expect(formatHumanStatus("success", "done")).not.toMatch(/\x1b\[[0-9;]*m/);
  });

  it("plain headers avoid ANSI and mandatory Unicode", () => {
    const plain = createPlainBrandHeader();
    // eslint-disable-next-line no-control-regex
    expect(plain).not.toMatch(/\x1b\[[0-9;]*m/);
    expect([...plain].every((char) => char.charCodeAt(0) <= 127)).toBe(true);
  });

  it("documents audit help disclaimer without compliance claims", () => {
    expect(AUDIT_HELP_DISCLAIMER).toContain("does not establish WCAG conformance");
    expect(AUDIT_HELP_DISCLAIMER).toContain("manual testing");
    expect(AUDIT_HELP_DISCLAIMER).not.toMatch(/compliant|certified|perfect/i);
  });
});
