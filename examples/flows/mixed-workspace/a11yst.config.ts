import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6341;

export default defineConfig({
  projects: [
    {
      name: "flows-mixed-web",
      rootDir: "apps/web",
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
        { id: "home", name: "Web home", path: "/" },
        { id: "panel", name: "Panel view", path: "/panel" },
      ],
      profiles: ["default", "keyboard"],
      viewports: [{ name: "desktop", width: 1280, height: 800 }],
      flows: [
        {
          id: "panel-toggle",
          name: "Open and close an expandable panel",
          start: "/",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Show details panel" },
            },
            {
              action: "checkpoint",
              id: "panel-open",
              name: "Details panel open",
            },
            {
              action: "click",
              locator: { role: "button", name: "Hide details panel" },
            },
            {
              action: "checkpoint",
              id: "panel-closed",
              name: "Details panel closed",
            },
          ],
        },
      ],
    },
  ],
});
