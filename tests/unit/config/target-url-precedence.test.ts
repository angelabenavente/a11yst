import { describe, expect, it } from "vitest";
import { validateConfig } from "@a11yst/config";

describe("target URL resolution precedence", () => {
  it("keeps explicit validated baseUrl authoritative over framework defaults", () => {
    const validated = validateConfig(
      {
        projects: [
          {
            name: "website",
            platform: "web",
            framework: "react",
            baseUrl: "http://localhost:3000",
            devServer: {
              command: "npm run dev",
              url: "http://localhost:3000",
            },
            routes: ["/"],
            profiles: ["default"],
          },
        ],
      },
      { configDir: "/tmp/a11yst-config" },
    );
    const project = validated.projects[0];
    expect(project?.platform).toBe("web");
    if (project && project.platform === "web") {
      expect(project.baseUrl).toBe("http://localhost:3000");
    }
  });
});
