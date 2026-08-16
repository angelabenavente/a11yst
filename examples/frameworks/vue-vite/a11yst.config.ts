import { defineConfig } from "@a11yst/config";

const port = process.env.PORT ?? "5291";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: "framework-vue-vite",
      rootDir: ".",
      platform: "web",
      framework: "vue",
      baseUrl: origin,
      devServer: {
        command: "node serve.mjs",
        url: origin,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes: [
        { id: "home", name: "Home", path: "/" },
        { id: "issues", name: "Issues", path: "/issues" },
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
