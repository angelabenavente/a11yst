import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "coverage/**",
      "examples/**",
      "**/*.tsbuildinfo",
      "tests/fixtures/source-index/**",
      "tests/fixtures/source-mapping-html/**",
      "tests/fixtures/source-mapping-react/**",
      "tests/fixtures/source-mapping-next/**",
      "tests/fixtures/source-mapping-vue/**",
      "tests/fixtures/source-mapping-nuxt/**",
      "tests/fixtures/source-mapping-angular/**",
      "tests/fixtures/source-analysis/**",
      ".a11yst-temp-*/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
);
