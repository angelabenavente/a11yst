import { defineConfig, mergeConfig } from "vitest/config";
import { sharedVitestConfig } from "./vitest.shared.js";

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      name: "unit",
      include: ["tests/unit/**/*.test.ts"],
      fileParallelism: true,
    },
  }),
);
