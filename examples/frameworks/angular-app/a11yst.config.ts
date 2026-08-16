import { defineConfig } from "@a11yst/config";

const port = process.env.PORT ?? "4291";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: "framework-angular-app",
      rootDir: ".",
      platform: "web",
      framework: "angular",
      baseUrl: origin,
      devServer: {
        command: "node serve.mjs",
        url: origin,
        reuseExisting: true,
        startupTimeout: 120_000,
      },
      routes: [
        { id: "home", name: "Home", path: "/" },
        { id: "contact", name: "Contact", path: "/contact" },
      ],
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
