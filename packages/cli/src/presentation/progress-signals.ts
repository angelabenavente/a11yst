import { stopActiveProgressReporter } from "./progress-reporter.js";

let signalsRegistered = false;

export function registerProgressSignalHandlers(): void {
  if (signalsRegistered) {
    return;
  }
  signalsRegistered = true;
  const cleanup = () => {
    stopActiveProgressReporter();
  };
  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
}
