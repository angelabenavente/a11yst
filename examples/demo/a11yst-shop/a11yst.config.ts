import { defineConfig } from "@a11yst/config";

const PORT = Number(process.env.PORT ?? 6420);
const DEMO_STAGE_ENV_KEY = "A11YST_DEMO_STAGE";

function resolveDemoStage() {
  const raw = process.env[DEMO_STAGE_ENV_KEY];
  if (raw === undefined || raw === "" || raw === "current") {
    return "current";
  }
  if (raw === "baseline") {
    return "baseline";
  }
  throw new Error(
    `Invalid A11YST_DEMO_STAGE "${raw}". Use "baseline" or "current".`,
  );
}

const stage = resolveDemoStage();

const accountRoute = { id: "account", name: "Account", path: "/account" };
const checkoutRoute = { id: "checkout", name: "Checkout", path: "/checkout" };

const routes =
  stage === "baseline" ? [accountRoute] : [accountRoute, checkoutRoute];

const flows =
  stage === "current"
    ? [
        {
          id: "checkout-help",
          name: "Open checkout help dialog",
          start: "/checkout",
          profiles: ["default", "keyboard"],
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { css: "#open-help" },
            },
            {
              action: "checkpoint",
              id: "help-dialog-open",
              name: "Help dialog open",
            },
          ],
        },
      ]
    : undefined;

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
    junit: true,
    markdown: true,
    githubAnnotations: true,
  },
  baseline: {
    file: ".a11yst/baseline.json",
    compare: true,
    classifications: true,
  },
  ci:
    stage === "current"
      ? {
          failOnNew: true,
          failOnRegression: true,
          failOnExpiredClassification: true,
          minimumSeverity: "high",
        }
      : {
          failOnNew: false,
          failOnRegression: false,
          failOnExpiredClassification: false,
        },
  evidence: {
    screenshots: true,
    fullPage: false,
  },
  projects: [
    {
      name: "a11yst-shop",
      rootDir: ".",
      platform: "web",
      framework: "html",
      baseUrl: `http://127.0.0.1:${PORT}`,
      devServer: {
        command: "node server.mjs",
        url: `http://127.0.0.1:${PORT}`,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes,
      profiles: ["default", "keyboard"],
      viewports: [
        {
          name: "mobile",
          width: 390,
          height: 844,
          isMobile: true,
          hasTouch: true,
        },
        {
          name: "desktop",
          width: 1440,
          height: 900,
        },
      ],
      flows,
    },
  ],
});
