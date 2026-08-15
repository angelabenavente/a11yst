import { describe, expect, it } from "vitest";
import {
  detectStaticViteConfigPort,
  parseStaticViteServerPort,
} from "@a11yst/detect";

describe("parseStaticViteServerPort", () => {
  it("reads server.port from defineConfig object syntax", () => {
    const content = `
      export default defineConfig({
        server: {
          port: 3000,
        },
      });
    `;
    expect(parseStaticViteServerPort(content)).toBe(3000);
  });

  it("reads server.port from plain object export", () => {
    const content = `
      export default {
        server: {
          port: 4001
        }
      };
    `;
    expect(parseStaticViteServerPort(content)).toBe(4001);
  });

  it("ignores preview.port blocks", () => {
    const content = `
      export default {
        preview: { port: 9999 },
        server: { port: 3000 },
      };
    `;
    expect(parseStaticViteServerPort(content)).toBe(3000);
  });

  it("returns undefined for dynamic or missing ports", () => {
    expect(parseStaticViteServerPort(`export default { server: { port: process.env.PORT } };`)).toBeUndefined();
    expect(parseStaticViteServerPort(`export default {};`)).toBeUndefined();
  });
});

describe("detectStaticViteConfigPort", () => {
  it("detects port 3000 from the react-vite-port-3000 fixture", async () => {
    const { join } = await import("node:path");
    const { repoRoot } = await import("../../helpers/cli.js");
    const detection = detectStaticViteConfigPort(
      join(repoRoot, "examples/detection/react-vite-port-3000"),
    );
    expect(detection?.port).toBe(3000);
    expect(detection?.sourceLabel).toBe("vite.config.ts · server.port");
  });
});
