import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stripAnsi } from "../../../../packages/cli/src/presentation/ansi.js";
import { resolveTerminalCapabilities } from "../../../../packages/cli/src/presentation/capabilities.js";
import {
  parseProgressMode,
  resolveProgressAnimationEnabled,
  resolveProgressModeFromCli,
} from "../../../../packages/cli/src/presentation/progress-mode.js";
import {
  createProgressReporter,
  stopActiveProgressReporter,
} from "../../../../packages/cli/src/presentation/progress-reporter.js";

function createMockStream(): NodeJS.WriteStream {
  let output = "";
  return {
    isTTY: true,
    write(chunk: string) {
      output += chunk;
      return true;
    },
    getOutput() {
      return output;
    },
    clear() {
      output = "";
    },
  } as unknown as NodeJS.WriteStream & { getOutput(): string; clear(): void };
}

describe("parseProgressMode", () => {
  it("defaults unknown values to auto", () => {
    expect(parseProgressMode(undefined)).toBe("auto");
    expect(parseProgressMode("bogus")).toBe("auto");
  });
});

describe("resolveProgressModeFromCli", () => {
  it("maps --no-progress to never", () => {
    expect(resolveProgressModeFromCli({ noProgress: true })).toBe("never");
  });
});

describe("resolveProgressAnimationEnabled", () => {
  const interactive = resolveTerminalCapabilities({
    isTTY: true,
    isStderrTTY: true,
    isCI: false,
    term: "xterm-256color",
    noColor: false,
  });

  it("enables auto on interactive stderr TTY", () => {
    expect(
      resolveProgressAnimationEnabled({
        mode: "auto",
        machineOutput: false,
        capabilities: interactive,
      }),
    ).toBe(true);
  });

  it("disables auto in CI", () => {
    expect(
      resolveProgressAnimationEnabled({
        mode: "auto",
        machineOutput: false,
        capabilities: { ...interactive, isCI: true },
      }),
    ).toBe(false);
  });

  it("disables auto for machine output regardless of TTY", () => {
    expect(
      resolveProgressAnimationEnabled({
        mode: "auto",
        machineOutput: true,
        capabilities: interactive,
      }),
    ).toBe(false);
  });

  it("respects never mode", () => {
    expect(
      resolveProgressAnimationEnabled({
        mode: "never",
        machineOutput: false,
        capabilities: interactive,
      }),
    ).toBe(false);
  });
});

describe("createProgressReporter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopActiveProgressReporter();
    vi.useRealTimers();
  });

  it("animates on stderr TTY with auto mode after delay", () => {
    const stream = createMockStream();
    const progress = createProgressReporter({
      mode: "auto",
      machineOutput: false,
      capabilities: resolveTerminalCapabilities({
        isTTY: true,
        isStderrTTY: true,
        isCI: false,
        term: "xterm-256color",
      }),
      stream,
      setIntervalFn: ((fn: () => void) => {
        fn();
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearIntervalFn: vi.fn(),
      setTimeoutFn: ((fn: () => void) => {
        fn();
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeoutFn: vi.fn(),
    });

    progress.start("Launching Chromium");
    expect(stripAnsi((stream as NodeJS.WriteStream & { getOutput(): string }).getOutput())).toContain(
      "Launching Chromium",
    );
    progress.succeed("Chromium ready");
    expect(stripAnsi((stream as NodeJS.WriteStream & { getOutput(): string }).getOutput())).toContain(
      "Chromium ready",
    );
  });

  it("does not write spinner frames for machine output", () => {
    const stream = createMockStream();
    const progress = createProgressReporter({
      mode: "auto",
      machineOutput: true,
      capabilities: resolveTerminalCapabilities({
        isTTY: true,
        isStderrTTY: true,
        isCI: false,
      }),
      stream,
    });
    progress.start("Scanning project");
    progress.succeed("Scan complete");
    expect((stream as NodeJS.WriteStream & { getOutput(): string }).getOutput()).toBe("");
  });

  it("shows real counts without percentages", () => {
    const stream = createMockStream();
    const progress = createProgressReporter({
      mode: "always",
      machineOutput: false,
      capabilities: resolveTerminalCapabilities({
        isTTY: true,
        isStderrTTY: true,
        isCI: false,
        term: "xterm-256color",
      }),
      stream,
      setIntervalFn: ((fn: () => void) => {
        fn();
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearIntervalFn: vi.fn(),
      setTimeoutFn: ((fn: () => void) => {
        fn();
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeoutFn: vi.fn(),
    });
    progress.progress(3, 10, "Auditing /projects · default · desktop");
    const output = stripAnsi((stream as NodeJS.WriteStream & { getOutput(): string }).getOutput());
    expect(output).toContain("3/10");
    expect(output).toContain("Auditing /projects · default · desktop");
    expect(output).not.toContain("%");
    progress.stop();
  });

  it("cleans up active interval on stop", () => {
    const clearIntervalFn = vi.fn();
    const clearTimeoutFn = vi.fn();
    const stream = createMockStream();
    const progress = createProgressReporter({
      mode: "always",
      machineOutput: false,
      capabilities: resolveTerminalCapabilities({
        isTTY: true,
        isStderrTTY: true,
        isCI: false,
        term: "xterm-256color",
      }),
      stream,
      setIntervalFn: (() => 42 as unknown as ReturnType<typeof setInterval>) as unknown as typeof setInterval,
      clearIntervalFn,
      setTimeoutFn: ((fn: () => void) => {
        fn();
        return 7 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeoutFn,
    });
    progress.start("Waiting for server");
    progress.stop();
    expect(clearIntervalFn).toHaveBeenCalled();
    expect(clearTimeoutFn).toHaveBeenCalled();
  });

  it("keeps progress enabled when NO_COLOR is set", () => {
    const stream = createMockStream();
    const progress = createProgressReporter({
      mode: "auto",
      machineOutput: false,
      capabilities: resolveTerminalCapabilities({
        isTTY: true,
        isStderrTTY: true,
        isCI: false,
        noColor: true,
        term: "xterm-256color",
      }),
      stream,
      setIntervalFn: ((fn: () => void) => {
        fn();
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearIntervalFn: vi.fn(),
      setTimeoutFn: ((fn: () => void) => {
        fn();
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeoutFn: vi.fn(),
    });
    progress.start("Analyzing source");
    expect((stream as NodeJS.WriteStream & { getOutput(): string }).getOutput().length).toBeGreaterThan(0);
    progress.stop();
  });

  it("stops animation before fail output", () => {
    const stream = createMockStream();
    const progress = createProgressReporter({
      mode: "always",
      machineOutput: false,
      capabilities: resolveTerminalCapabilities({
        isTTY: true,
        isStderrTTY: true,
        isCI: false,
        term: "xterm-256color",
      }),
      stream,
      setIntervalFn: ((fn: () => void) => {
        fn();
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearIntervalFn: vi.fn(),
      setTimeoutFn: ((fn: () => void) => {
        fn();
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeoutFn: vi.fn(),
    });
    progress.start("Waiting for http://localhost:3000");
    progress.fail("Dev server was not ready");
    const output = (stream as NodeJS.WriteStream & { getOutput(): string }).getOutput();
    expect(output).toContain("Dev server was not ready");
    expect(output.endsWith("\n")).toBe(true);
  });
});
