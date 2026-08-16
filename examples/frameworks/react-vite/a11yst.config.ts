import { defineConfig } from "@a11yst/config";

const port = process.env.PORT ?? "5191";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: "framework-react-vite",
      rootDir: ".",
      platform: "web",
      framework: "react",
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
