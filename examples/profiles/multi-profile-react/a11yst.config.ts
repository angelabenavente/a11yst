import { defineConfig } from "@a11yst/config";

const port = process.env.PORT ?? "6214";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  projects: [
    {
      name: "profiles-multi-profile-react",
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
        { id: "checkout", name: "Checkout", path: "/checkout" },
      ],
      routeDiscovery: {
        mode: "fallback",
      },
      profiles: ["default", "keyboard", "large-text", "reduced-motion"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
    },
  ],
});
