import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6401;

export default defineConfig({
  baseline: {
    compare: true,
    classifications: true,
  },
  projects: [
    {
      name: "baseline-legacy-html",
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
        { id: "home", name: "Home", path: "/" },
        { id: "contact", name: "Contact", path: "/contact" },
        { id: "fixed", name: "Fixed", path: "/fixed" },
        { id: "review", name: "Review", path: "/review" },
      ],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
});
