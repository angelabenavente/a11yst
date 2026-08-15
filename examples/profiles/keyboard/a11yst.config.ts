import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6211;

export default defineConfig({
  projects: [
    {
      name: "profiles-keyboard",
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
        { id: "home", name: "Good focus order", path: "/" },
        { id: "issues", name: "Keyboard issues", path: "/issues" },
      ],
      profiles: ["keyboard"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
});
