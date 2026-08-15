import { describe, expect, it } from "vitest";
import { parseColorMode, resolveColorEnabled } from "../../../../packages/cli/src/presentation/color.js";
import { resolveTerminalCapabilities } from "../../../../packages/cli/src/presentation/capabilities.js";

describe("parseColorMode", () => {
  it("defaults unknown values to auto", () => {
    expect(parseColorMode(undefined)).toBe("auto");
    expect(parseColorMode("bogus")).toBe("auto");
  });

  it("accepts always and never", () => {
    expect(parseColorMode("always")).toBe("always");
    expect(parseColorMode("never")).toBe("never");
  });
});

describe("resolveColorEnabled priority", () => {
  const tty = resolveTerminalCapabilities({
    isTTY: true,
    isCI: false,
    term: "xterm-256color",
    noColor: false,
  });

  it("respects never before always", () => {
    expect(resolveColorEnabled("never", tty)).toBe(false);
  });

  it("respects NO_COLOR before always", () => {
    const noColor = resolveTerminalCapabilities({
      isTTY: true,
      isCI: false,
      term: "xterm-256color",
      noColor: true,
    });
    expect(resolveColorEnabled("always", noColor)).toBe(false);
  });
});
