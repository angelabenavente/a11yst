import { defineConfig } from "@a11yst/config";

export default defineConfig({
  projects: [
    {
      name: "html-basic",
      platform: "web",
      framework: "html",
      baseUrl: "http://localhost:4173",
      routes: ["/", "/about"],
      profiles: ["default"],
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
