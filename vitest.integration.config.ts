import { defineConfig, mergeConfig } from "vitest/config";
import { sharedVitestConfig } from "./vitest.shared.js";

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      name: "integration",
      include: ["tests/integration/**/*.test.ts"],
      // These files launch Chromium, dev servers, and OS processes.
      // One worker keeps fixed ports and process lifecycle isolated.
      fileParallelism: false,
      minWorkers: 1,
      maxWorkers: 1,
    },
  }),
);
