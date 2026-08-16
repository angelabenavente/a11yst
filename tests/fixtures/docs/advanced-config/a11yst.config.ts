import { defineConfig } from "@a11yst/config";

/**
 * Documented advanced configuration fixture.
 * Validated by tests/unit/docs/advanced-config.test.ts
 */
export default defineConfig({
  outputDir: ".a11yst/results",
  sourceAnalysis: {
    enabled: true,
    ranking: true,
    recommendations: true,
  },
  reports: {
    html: true,
    sarif: true,
    junit: false,
    markdown: true,
  },
  baseline: {
    file: ".a11yst/baseline.json",
    compare: true,
    classifications: true,
  },
  ci: {
    failOnNew: true,
    failOnRegression: true,
    failOnExpiredClassification: true,
    minimumSeverity: "high",
  },
  evidence: {
    screenshots: true,
    fullPage: false,
  },
  projects: [
    {
      name: "docs-web",
      rootDir: ".",
      platform: "web",
      framework: "html",
      baseUrl: "http://127.0.0.1:3000",
      devServer: {
        command: "node serve.mjs",
        url: "http://127.0.0.1:3000",
        reuseExisting: true,
        startupTimeout: 60_000,
      },
      routes: [
        { id: "home", name: "Home", path: "/" },
        "/about",
      ],
      routeDiscovery: {
        mode: "fallback",
        samples: {
          "/products/:id": ["/products/example"],
        },
      },
      profiles: [
        "default",
        {
          id: "keyboard",
          maxTabStops: 50,
          detectFocusTraps: true,
          captureFocusEvidence: true,
        },
        "large-text",
      ],
      viewports: [
        {
          name: "mobile",
          width: 390,
          height: 844,
          isMobile: true,
          hasTouch: true,
        },
        { name: "desktop", width: 1440, height: 900 },
      ],
      flows: [
        {
          id: "checkout-errors",
          name: "Submit with validation errors",
          start: "/",
          profiles: ["default", "keyboard"],
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Checkout" },
            },
            {
              action: "checkpoint",
              id: "errors",
              name: "Validation errors visible",
            },
          ],
        },
      ],
    },
  ],
});
