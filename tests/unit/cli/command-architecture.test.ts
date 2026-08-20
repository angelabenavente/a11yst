import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createCliProgram } from "../../../packages/cli/src/command-program.js";

describe("CLI command architecture", () => {
  it("registers commands without parsing arguments", async () => {
    const program = createCliProgram({
      argv: ["node", "a11yst"],
      cwd: process.cwd(),
    });
    const commandNames = program.commands.map((command) => command.name());
    expect(commandNames).toEqual([
      "detect",
      "init",
      "flows",
      "routes",
      "audit",
      "report",
      "profiles",
      "doctor",
      "baseline",
      "findings",
      "classify",
      "unclassify",
    ]);
    expect(
      program.commands
        .find((command) => command.name() === "baseline")
        ?.commands.map((command) => command.name()),
    ).toEqual(["create", "status", "update", "migrate"]);

    const source = await readFile(
      new URL("../../../packages/cli/src/command-program.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain("export function createCliProgram(");
    expect(source).not.toContain(".parseAsync(");
  });

  it("keeps command definitions out of the execution module", async () => {
    const source = await readFile(
      new URL("../../../packages/cli/src/run-cli.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain("program.parseAsync(argv)");
    expect(source).not.toContain(".command(");
  });
});
