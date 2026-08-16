import { defineConfig } from "@a11yst/config";

const port = process.env.PORT ?? "5181";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: "report-responsive-react",
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
      profiles: [
        "default",
        {
          id: "keyboard",
          maxTabStops: 40,
          detectFocusTraps: true,
          captureFocusEvidence: true,
        },
      ],
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
