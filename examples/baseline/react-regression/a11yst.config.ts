import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6402;

export default defineConfig({
  baseline: {
    compare: true,
    classifications: true,
  },
  projects: [
    {
      name: "baseline-react-regression",
      rootDir: ".",
      platform: "web",
      framework: "react",
      baseUrl: `http://127.0.0.1:${PORT}`,
      devServer: {
        command: "pnpm dev",
        url: `http://127.0.0.1:${PORT}`,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes: [
        { id: "baseline", name: "Baseline variant", path: "/v/baseline" },
        { id: "new", name: "New finding variant", path: "/v/new" },
        { id: "resolved", name: "Resolved variant", path: "/v/resolved" },
        { id: "severity", name: "Severity regression variant", path: "/v/severity" },
        { id: "playground", name: "Query param playground", path: "/?variant=baseline" },
      ],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
});
