import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6331;

export default defineConfig({
  projects: [
    {
      name: "flows-vue-menu",
      rootDir: ".",
      platform: "web",
      framework: "vue",
      baseUrl: `http://127.0.0.1:${PORT}`,
      devServer: {
        command: "node serve.mjs",
        url: `http://127.0.0.1:${PORT}`,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes: [
        { id: "home", name: "Fixture index", path: "/" },
        { id: "accessible", name: "Accessible menu", path: "/accessible" },
        { id: "bad", name: "Bad menu", path: "/bad" },
      ],
      profiles: ["default", "keyboard"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
      flows: [
        {
          id: "menu-open-close",
          name: "Accessible menu open and close",
          start: "/accessible",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Open accessible menu" },
            },
            {
              action: "checkpoint",
              id: "menu-open",
              name: "Accessible menu open",
            },
            {
              action: "press",
              key: "Escape",
            },
            {
              action: "checkpoint",
              id: "menu-closed",
              name: "Accessible menu closed",
            },
          ],
        },
        {
          id: "menu-open-close-bad",
          name: "Menu with Escape and focus issues",
          start: "/bad",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Open bad menu" },
            },
            {
              action: "checkpoint",
              id: "menu-open",
              name: "Bad menu open",
            },
            {
              action: "press",
              key: "Escape",
            },
            {
              action: "checkpoint",
              id: "menu-closed",
              name: "Bad menu after Escape",
            },
          ],
        },
      ],
    },
  ],
});
