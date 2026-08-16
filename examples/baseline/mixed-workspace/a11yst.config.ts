import { defineConfig } from "@a11yst/config";

const port = process.env.PORT ?? 6405;
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  baseline: {
    compare: true,
    classifications: true,
  },
  projects: [
    {
      name: "baseline-mixed-web",
      rootDir: "apps/web",
      platform: "web",
      framework: "html",
      baseUrl: origin,
      devServer: {
        command: "node serve.mjs",
        url: origin,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes: [{ id: "home", name: "Web home", path: "/" }],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1280, height: 800 }],
    },
  ],
});
