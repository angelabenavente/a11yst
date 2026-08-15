/** Whether ANSI colour is allowed. Respects NO_COLOR and non-TTY stdout. */
export function colorEnabled(stream: NodeJS.WriteStream = process.stdout): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") {
    return false;
  }
  if (process.env.FORCE_COLOR === "0") {
    return false;
  }
  return Boolean(stream.isTTY);
}

export function writeStdout(message: string): void {
  process.stdout.write(message.endsWith("\n") ? message : `${message}\n`);
}

export function writeStderr(message: string): void {
  process.stderr.write(message.endsWith("\n") ? message : `${message}\n`);
}

export function writeJson(value: unknown, stream: NodeJS.WriteStream = process.stdout): void {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function formatLabelValue(label: string, value: string | number, width = 12): string {
  return `${label.padEnd(width)}${value}`;
}

export function preparingMessage(): string {
  return "Preparing project.";
}

export function checkingMessage(): string {
  return "Running accessibility audit.";
}
