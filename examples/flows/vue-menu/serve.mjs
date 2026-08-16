import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const viteBin = resolve(dirname(require.resolve("vite")), "bin/vite.js");
const port = process.env.PORT ?? "6331";
const child = spawn(
  process.execPath,
  [viteBin, "--host", "127.0.0.1", "--port", port, "--strictPort"],
  { stdio: "inherit", env: process.env },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
