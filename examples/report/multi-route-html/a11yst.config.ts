import { defineConfig } from "@a11yst/config";

const port = process.env.PORT ?? "4181";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: "report-multi-route-html",
      rootDir: ".",
      platform: "web",
      framework: "html",
      baseUrl: origin,
      devServer: {
        command: "node serve.mjs",
        url: origin,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes: [
        { id: "home", name: "Home", path: "/" },
        { id: "button", name: "Unnamed button", path: "/button" },
        { id: "form", name: "Unlabelled form", path: "/form" },
      ],
      profiles: ["default"],
      viewports: [
        {
          name: "mobile",
          width: 390,
          height: 844,
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        },
        {
          name: "desktop",
          width: 1440,
          height: 900,
        },
      ],
    },
  ],
});
