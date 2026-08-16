import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const nuxtRoot = dirname(require.resolve("nuxt/package.json"));
const nuxtBin = resolve(nuxtRoot, "bin/nuxt.mjs");
const port = process.env.PORT ?? "3291";
const child = spawn(
  process.execPath,
  [nuxtBin, "dev", "--host", "127.0.0.1", "--port", port],
  {
    stdio: "inherit",
    env: { ...process.env, NUXT_IGNORE_LOCK: process.env.NUXT_IGNORE_LOCK ?? "1" },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
