import { defineConfig } from "@a11yst/config";

const port = process.env.PORT ?? "3091";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: "framework-next-app",
      rootDir: ".",
      platform: "web",
      framework: "next",
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
          "/products/:id": ["/products/example"],
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
