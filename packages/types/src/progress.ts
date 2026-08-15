/** Product-layer progress events; presentation maps these to terminal UI. */
export interface ProgressReporter {
  start(label: string): void;
  update(label: string): void;
  succeed(label: string): void;
  warn(label: string): void;
  fail(label: string): void;
  progress(current: number, total: number, label: string): void;
  stop(): void;
  pause?(): void;
  resume?(): void;
}

export const noopProgressReporter: ProgressReporter = {
  start() {},
  update() {},
  succeed() {},
  warn() {},
  fail() {},
  progress() {},
  stop() {},
};
