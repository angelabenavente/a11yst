import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    server: {
      deps: {
        inline: ["fast-xml-parser"],
      },
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Several Phase 3 integration tests spawn real dev servers/Chromium
    // against fixed ports (e.g. examples/audit/react-inaccessible, which is
    // pinned to 5177 by design) or manage OS-level processes. Running test
    // files in parallel worker processes would let those collide across
    // files; running one file at a time keeps them deterministic. Tests
    // within a file that don't need this can still use `.concurrent`.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@a11yst/types": resolve(__dirname, "packages/types/src/index.ts"),
      "@a11yst/config": resolve(__dirname, "packages/config/src/index.ts"),
      "@a11yst/flows": resolve(__dirname, "packages/flows/src/index.ts"),
      "@a11yst/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@a11yst/detect": resolve(__dirname, "packages/detect/src/index.ts"),
      "@a11yst/browser": resolve(__dirname, "packages/browser/src/index.ts"),
      "@a11yst/cli": resolve(__dirname, "packages/cli/src/index.ts"),
      "@a11yst/artifacts": resolve(__dirname, "packages/artifacts/src/index.ts"),
      "@a11yst/reporters": resolve(__dirname, "packages/reporters/src/index.ts"),
      "@a11yst/adapters": resolve(__dirname, "packages/adapters/src/index.ts"),
      "@a11yst/profiles": resolve(__dirname, "packages/profiles/src/index.ts"),
      "@a11yst/rules": resolve(__dirname, "packages/rules/src/index.ts"),
      "@a11yst/baseline": resolve(__dirname, "packages/baseline/src/index.ts"),
      "@a11yst/policy": resolve(__dirname, "packages/policy/src/index.ts"),
      "@a11yst/sarif": resolve(__dirname, "packages/sarif/src/index.ts"),
      "@a11yst/junit": resolve(__dirname, "packages/junit/src/index.ts"),
      "@a11yst/source-mapping": resolve(__dirname, "packages/source-mapping/src/index.ts"),
      "@a11yst/source-index": resolve(__dirname, "packages/source-index/src/index.ts"),
      "@a11yst/source-mapping-html": resolve(__dirname, "packages/source-mapping-html/src/index.ts"),
      "@a11yst/source-mapping-react": resolve(__dirname, "packages/source-mapping-react/src/index.ts"),
      "@a11yst/source-mapping-next": resolve(__dirname, "packages/source-mapping-next/src/index.ts"),
      "@a11yst/source-mapping-vue": resolve(__dirname, "packages/source-mapping-vue/src/index.ts"),
      "@a11yst/source-mapping-nuxt": resolve(__dirname, "packages/source-mapping-nuxt/src/index.ts"),
      "@a11yst/source-mapping-angular": resolve(__dirname, "packages/source-mapping-angular/src/index.ts"),
      "@a11yst/source-ranking": resolve(__dirname, "packages/source-ranking/src/index.ts"),
      "@a11yst/recommendations": resolve(__dirname, "packages/recommendations/src/index.ts"),
      "@a11yst/source-analysis": resolve(__dirname, "packages/source-analysis/src/index.ts"),
    },
  },
});
