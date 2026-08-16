import { defineConfig } from "@a11yst/config";

/**
 * Example a11yst configuration for CI pipelines.
 * Copy and adapt projects, routes, and server settings for your application.
 */
export default defineConfig({
  ci: {
    failOnNew: true,
    failOnRegression: true,
    failOnExpiredClassification: true,
    minimumSeverity: "high",
  },

  reports: {
    sarif: true,
    junit: true,
    markdown: true,
    githubAnnotations: false,
    githubStepSummary: false,
  },

  baseline: {
    file: ".a11yst/baseline.json",
    compare: true,
    classifications: true,
  },

  projects: [
    {
      name: "web",
      rootDir: ".",
      platform: "web",
      framework: "html",
      baseUrl: "http://127.0.0.1:3000",
      devServer: {
        command: "pnpm start",
        url: "http://127.0.0.1:3000",
        reuseExisting: true,
        startupTimeout: 60_000,
      },
      routes: [{ id: "home", name: "Home", path: "/" }],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    },
  ],
});
