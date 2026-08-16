import { defineConfig } from "@a11yst/config";

const port = process.env.PORT ?? "3291";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: "framework-nuxt-app",
      rootDir: ".",
      platform: "web",
      framework: "nuxt",
      baseUrl: origin,
      devServer: {
        command: "node serve.mjs",
        url: origin,
        reuseExisting: true,
        startupTimeout: 120_000,
      },
      routeDiscovery: {
        mode: "fallback",
        samples: {
          "/users/:id": ["/users/example"],
        },
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
