import { createCliProgram } from "./command-program.js";
import { writeStderr } from "./output.js";

export interface RunCliOptions {
  argv?: string[];
  cwd?: string;
}

export async function runCli(options: RunCliOptions = {}): Promise<number> {
  const argv = options.argv ?? process.argv;
  const program = createCliProgram({ ...options, argv });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    writeStderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  return typeof process.exitCode === "number" ? process.exitCode : 0;
}
