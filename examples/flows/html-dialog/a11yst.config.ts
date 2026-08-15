import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6311;

export default defineConfig({
  projects: [
    {
      name: "flows-html-dialog",
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
        { id: "home", name: "Dialog fixtures", path: "/" },
        { id: "accessible", name: "Accessible dialog", path: "/accessible" },
        { id: "bad", name: "Bad dialog focus", path: "/bad" },
      ],
      profiles: ["default", "keyboard"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
      flows: [
        {
          id: "dialog-accessible",
          name: "Accessible dialog open and close",
          start: "/accessible",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Open accessible dialog" },
            },
            {
              action: "checkpoint",
              id: "dialog-open",
              name: "Accessible dialog open",
            },
            {
              action: "click",
              locator: { role: "button", name: "Close" },
            },
            {
              action: "checkpoint",
              id: "dialog-closed",
              name: "Accessible dialog closed",
            },
          ],
        },
        {
          id: "dialog-bad",
          name: "Dialog with focus entry issue",
          start: "/bad",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Open bad dialog" },
            },
            {
              action: "checkpoint",
              id: "dialog-open",
              name: "Bad dialog open",
            },
            {
              action: "click",
              locator: { role: "button", name: "Close" },
            },
            {
              action: "checkpoint",
              id: "dialog-closed",
              name: "Bad dialog closed",
            },
          ],
        },
      ],
    },
  ],
});
