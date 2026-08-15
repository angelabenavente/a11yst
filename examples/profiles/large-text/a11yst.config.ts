import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6212;

export default defineConfig({
  projects: [
    {
      name: "profiles-large-text",
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
        { id: "good", name: "Scales fine", path: "/good" },
        { id: "overflow", name: "Horizontal overflow", path: "/overflow" },
        { id: "clip", name: "Clipped text", path: "/clip" },
        { id: "overlap", name: "Overlapping elements", path: "/overlap" },
      ],
      profiles: ["large-text"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
});
