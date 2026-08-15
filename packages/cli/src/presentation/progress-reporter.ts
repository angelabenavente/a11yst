import type { ProgressReporter } from "@a11yst/types";
import { styleText } from "./ansi.js";
import type { ColorMode } from "./color.js";
import { resolveColorEnabled } from "./color.js";
import {
  resolveProgressAnimationEnabled,
  resolveProgressStaticEnabled,
  type ProgressMode,
} from "./progress-mode.js";
import type { TerminalCapabilities } from "./types.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const SPINNER_INTERVAL_MS = 100;
const SPINNER_DELAY_MS = 150;

// Clear current stderr line before redraw
const CLEAR_LINE = "\r\u001b[2K";

export interface CreateProgressReporterOptions {
  mode: ProgressMode;
  machineOutput: boolean;
  capabilities: TerminalCapabilities;
  colorMode?: ColorMode;
  stream?: NodeJS.WriteStream;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

let activeReporter: TerminalProgressReporter | undefined;

export function stopActiveProgressReporter(): void {
  activeReporter?.stop();
}

class TerminalProgressReporter implements ProgressReporter {
  readonly #stream: NodeJS.WriteStream;
  readonly #animate: boolean;
  readonly #static: boolean;
  readonly #colorEnabled: boolean;
  readonly #setIntervalFn: typeof setInterval;
  readonly #clearIntervalFn: typeof clearInterval;
  readonly #setTimeoutFn: typeof setTimeout;
  readonly #clearTimeoutFn: typeof clearTimeout;

  #interval: ReturnType<typeof setInterval> | undefined;
  #delayTimer: ReturnType<typeof setTimeout> | undefined;
  #frameIndex = 0;
  #label = "";
  #active = false;
  #paused = false;
  #mode: "spinner" | "count" = "spinner";
  #countCurrent = 0;
  #countTotal = 0;

  constructor(options: CreateProgressReporterOptions) {
    const input = {
      mode: options.mode,
      machineOutput: options.machineOutput,
      capabilities: options.capabilities,
    };
    this.#stream = options.stream ?? process.stderr;
    this.#animate = resolveProgressAnimationEnabled(input);
    this.#static = resolveProgressStaticEnabled(input);
    this.#colorEnabled = resolveColorEnabled(options.colorMode ?? "auto", options.capabilities);
    this.#setIntervalFn = options.setIntervalFn ?? setInterval;
    this.#clearIntervalFn = options.clearIntervalFn ?? clearInterval;
    this.#setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.#clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  }

  #enabled(): boolean {
    return this.#animate || this.#static;
  }

  #register(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- module-level active reporter for signal cleanup
    activeReporter = this;
  }

  #unregister(): void {
    if (activeReporter === this) {
      activeReporter = undefined;
    }
  }

  start(label: string): void {
    this.#label = label;
    if (!this.#enabled()) {
      return;
    }
    this.#mode = "spinner";
    this.#clearDelay();
    if (this.#animate) {
      this.#delayTimer = this.#setTimeoutFn(() => {
        this.#delayTimer = undefined;
        this.#beginSpinner();
      }, SPINNER_DELAY_MS);
      this.#register();
      return;
    }
    this.#writeStatic(`${label}…`);
  }

  update(label: string): void {
    this.#label = label;
    if (!this.#active || this.#paused) {
      return;
    }
    this.#render();
  }

  succeed(label: string): void {
    this.#finish(`${this.#symbol("✓", "ok")} ${label}`);
  }

  warn(label: string): void {
    this.#finish(`${this.#symbol("!", "warn")} ${label}`);
  }

  fail(label: string): void {
    this.#finish(`${this.#symbol("✗", "fail")} ${label}`);
  }

  progress(current: number, total: number, label: string): void {
    if (total <= 0) {
      this.start(label);
      return;
    }
    this.#label = label;
    this.#mode = "count";
    this.#countCurrent = current;
    this.#countTotal = total;
    if (!this.#enabled()) {
      return;
    }
    if (!this.#active) {
      this.#clearDelay();
      if (this.#animate) {
        this.#beginSpinner();
      } else {
        this.#writeStatic(this.#countLine());
      }
      return;
    }
    this.#render();
  }

  stop(): void {
    this.#clearDelay();
    this.#clearSpinnerFrame();
    this.#unregister();
  }

  pause(): void {
    if (!this.#active) {
      return;
    }
    this.#paused = true;
    this.#clearSpinnerFrame();
  }

  resume(): void {
    if (!this.#paused) {
      return;
    }
    this.#paused = false;
    if (this.#animate) {
      this.#beginSpinner();
    }
  }

  #symbol(text: string, kind: "ok" | "warn" | "fail"): string {
    if (!this.#colorEnabled) {
      return text;
    }
    const fg =
      kind === "ok" ? "\x1b[32m" : kind === "warn" ? "\x1b[33m" : "\x1b[31m";
    return styleText(text, { bold: true, fg }, true);
  }

  #countLine(): string {
    return `${this.#countCurrent}/${this.#countTotal} · ${this.#label}`;
  }

  #renderLine(): string {
    if (this.#mode === "count") {
      const frame = SPINNER_FRAMES[this.#frameIndex % SPINNER_FRAMES.length];
      return `${frame} ${this.#countLine()}…`;
    }
    const frame = SPINNER_FRAMES[this.#frameIndex % SPINNER_FRAMES.length];
    return `${frame} ${this.#label}${this.#label.endsWith("…") ? "" : "…"}`;
  }

  #beginSpinner(): void {
    this.#active = true;
    this.#paused = false;
    this.#register();
    this.#render();
    this.#interval = this.#setIntervalFn(() => {
      this.#frameIndex += 1;
      if (!this.#paused) {
        this.#render();
      }
    }, SPINNER_INTERVAL_MS);
  }

  #render(): void {
    if (!this.#animate || this.#paused) {
      return;
    }
    this.#stream.write(`${CLEAR_LINE}${this.#renderLine()}`);
  }

  #writeStatic(line: string): void {
    this.#stream.write(`${line}\n`);
  }

  #finish(line: string): void {
    this.#clearDelay();
    this.#clearSpinnerFrame();
    if (!this.#enabled()) {
      this.#unregister();
      return;
    }
    if (this.#animate) {
      this.#stream.write(`${CLEAR_LINE}${line}\n`);
    } else {
      this.#stream.write(`${line}\n`);
    }
    this.#active = false;
    this.#unregister();
  }

  #clearDelay(): void {
    if (this.#delayTimer !== undefined) {
      this.#clearTimeoutFn(this.#delayTimer);
      this.#delayTimer = undefined;
    }
  }

  #clearSpinnerFrame(): void {
    if (this.#interval !== undefined) {
      this.#clearIntervalFn(this.#interval);
      this.#interval = undefined;
    }
    if (this.#active && this.#animate) {
      this.#stream.write(CLEAR_LINE);
    }
    this.#active = false;
    this.#paused = false;
  }
}

export function createProgressReporter(
  options: CreateProgressReporterOptions,
): ProgressReporter {
  if (
    options.mode === "never" ||
    options.machineOutput ||
    (!resolveProgressAnimationEnabled({
      mode: options.mode,
      machineOutput: options.machineOutput,
      capabilities: options.capabilities,
    }) &&
      !resolveProgressStaticEnabled({
        mode: options.mode,
        machineOutput: options.machineOutput,
        capabilities: options.capabilities,
      }))
  ) {
    return {
      start() {},
      update() {},
      succeed() {},
      warn() {},
      fail() {},
      progress() {},
      stop() {},
      pause() {},
      resume() {},
    };
  }
  return new TerminalProgressReporter(options);
}
