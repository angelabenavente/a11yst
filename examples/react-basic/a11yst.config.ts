import { defineConfig } from "@a11yst/config";

export default defineConfig({
  projects: [
    {
      name: "react-basic",
      platform: "web",
      framework: "react",
      baseUrl: "http://localhost:5173",
      routes: ["/", "/settings"],
      profiles: ["default", "keyboard"],
      viewports: [
        {
          name: "mobile",
          width: 390,
          height: 844,
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
