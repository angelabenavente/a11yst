import { defineConfig } from "@a11yst/config";

const port = process.env.PORT ?? "4191";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: "framework-html-site",
      rootDir: ".",
      platform: "web",
      framework: "html",
      baseUrl: origin,
      devServer: {
        command: "node serve.mjs",
        url: origin,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routeDiscovery: {
        mode: "fallback",
      },
      profiles: ["default"],
      viewports: [
        {
          name: "desktop",
          width: 1440,
          height: 900,
        },
      ],
    },
  ],
});
