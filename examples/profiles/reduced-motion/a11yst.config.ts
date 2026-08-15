import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6213;

export default defineConfig({
  projects: [
    {
      name: "profiles-reduced-motion",
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
      routes: [
        { id: "good", name: "Respects preference", path: "/good" },
        { id: "bad-infinite", name: "Infinite spinner", path: "/bad-infinite" },
        { id: "long-transform", name: "Long transform", path: "/long-transform" },
        { id: "fade-control", name: "Brief fade", path: "/fade-control" },
      ],
      profiles: ["reduced-motion"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
});
