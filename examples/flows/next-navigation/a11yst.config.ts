import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6321;

export default defineConfig({
  projects: [
    {
      name: "flows-next-navigation",
      rootDir: ".",
      platform: "web",
      framework: "next",
      baseUrl: `http://127.0.0.1:${PORT}`,
      devServer: {
        command: "node serve.mjs",
        url: `http://127.0.0.1:${PORT}`,
        reuseExisting: true,
        startupTimeout: 120_000,
      },
      routes: [
        { id: "home", name: "Fixture index", path: "/" },
        { id: "accessible-home", name: "Accessible home", path: "/accessible" },
        { id: "accessible-about", name: "Accessible about", path: "/accessible/about" },
        { id: "bad-home", name: "Bad navigation home", path: "/bad" },
        { id: "bad-about", name: "Bad navigation about", path: "/bad/about" },
      ],
      profiles: ["default", "keyboard"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
      flows: [
        {
          id: "navigate-between-pages",
          name: "Accessible SPA navigation between pages",
          start: "/accessible",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "link", name: "About" },
            },
            {
              action: "checkpoint",
              id: "navigated-to-about",
              name: "Arrived on about page",
            },
            {
              action: "click",
              locator: { role: "link", name: "Home" },
            },
            {
              action: "checkpoint",
              id: "navigated-to-home",
              name: "Returned to home page",
            },
          ],
        },
        {
          id: "navigate-between-pages-bad",
          name: "SPA navigation without focus management",
          start: "/bad",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "link", name: "About" },
            },
            {
              action: "checkpoint",
              id: "navigated-to-about",
              name: "Arrived on about page",
            },
            {
              action: "click",
              locator: { role: "link", name: "Home" },
            },
            {
              action: "checkpoint",
              id: "navigated-to-home",
              name: "Returned to home page",
            },
          ],
        },
      ],
    },
  ],
});
