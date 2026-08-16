import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6404;

export default defineConfig({
  baseline: {
    compare: true,
    classifications: true,
  },
  projects: [
    {
      name: "baseline-classification-expiry",
      rootDir: ".",
      platform: "web",
      framework: "html",
      baseUrl: `http://127.0.0.1:${PORT}`,
      devServer: {
        command: "node serve.mjs",
        url: `http://127.0.0.1:${PORT}`,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes: [{ id: "home", name: "Classification expiry", path: "/" }],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
});
