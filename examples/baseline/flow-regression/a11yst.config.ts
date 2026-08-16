import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6403;

export default defineConfig({
  baseline: {
    compare: true,
    classifications: true,
  },
  projects: [
    {
      name: "baseline-flow-regression",
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
        { id: "home", name: "Flow index", path: "/" },
        { id: "known", name: "Known panel", path: "/known" },
        { id: "new", name: "New panel", path: "/new" },
        { id: "resolved", name: "Resolved panel", path: "/resolved" },
        { id: "partial", name: "Partial checkout", path: "/partial" },
      ],
      profiles: ["default", "keyboard"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
      flows: [
        {
          id: "panel-known",
          name: "Known dialog focus regression",
          start: "/known",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Open known panel" },
            },
            {
              action: "checkpoint",
              id: "panel-open",
              name: "Known panel open",
            },
          ],
        },
        {
          id: "panel-new",
          name: "Panel with new checkpoint finding",
          start: "/new",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Open new panel" },
            },
            {
              action: "checkpoint",
              id: "panel-open",
              name: "New panel open",
            },
          ],
        },
        {
          id: "panel-resolved",
          name: "Panel with resolved checkpoint finding",
          start: "/resolved",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Open resolved panel" },
            },
            {
              action: "checkpoint",
              id: "panel-open",
              name: "Resolved panel open",
            },
          ],
        },
        {
          id: "checkout-partial",
          name: "Checkout that stops before confirmation",
          start: "/partial",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Add sample item" },
            },
            {
              action: "checkpoint",
              id: "cart-ready",
              name: "Cart ready",
            },
            {
              action: "click",
              locator: { role: "button", name: "Continue to confirmation" },
            },
            {
              action: "checkpoint",
              id: "confirmation",
              name: "Confirmation visible",
            },
          ],
        },
        {
          id: "checkout-short",
          name: "Incomplete checkout (stops at cart)",
          start: "/partial?mode=short",
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Add sample item" },
            },
            {
              action: "checkpoint",
              id: "cart-ready",
              name: "Cart ready only",
            },
          ],
        },
      ],
    },
  ],
});
