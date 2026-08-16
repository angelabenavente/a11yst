import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const cliRoot = dirname(require.resolve("@angular/cli/package.json"));
const ngBin = resolve(cliRoot, "bin/ng.js");
const port = process.env.PORT ?? "4291";
const child = spawn(
  process.execPath,
  [ngBin, "serve", "--host", "127.0.0.1", "--port", port],
  { stdio: "inherit", env: process.env },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
