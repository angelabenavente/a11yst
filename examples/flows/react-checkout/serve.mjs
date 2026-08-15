import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);
const viteBin = resolve(dirname(require.resolve("vite")), "bin/vite.js");
const port = process.env.PORT ?? "6320";

function runVite(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [viteBin, ...args], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(undefined);
        return;
      }
      reject(new Error(`vite exited with code ${code ?? 1}`));
    });
  });
}

if (!existsSync(join(rootDir, "dist", "index.html"))) {
  await runVite(["build"]);
}

const child = spawn(
  process.execPath,
  [viteBin, "preview", "--host", "127.0.0.1", "--port", port, "--strictPort"],
  { stdio: "inherit", env: process.env },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
