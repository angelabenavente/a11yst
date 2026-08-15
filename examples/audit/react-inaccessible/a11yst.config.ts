import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 5177;

export default defineConfig({
  projects: [
    {
      name: "audit-react-inaccessible",
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
      routes: ["/", "/broken"],
      profiles: ["default", "keyboard"],
      viewports: [
        {
          name: "desktop",
          width: 1440,
          height: 900,
        },
      ],
    },
  ],
});
