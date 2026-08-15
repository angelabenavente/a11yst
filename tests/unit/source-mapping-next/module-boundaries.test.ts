import { describe, expect, it } from "vitest";
import { fixtureReactCatalog } from "./helpers.js";

describe("Next module boundaries", () => {
  it("detects use client in app files and defaults other app files to server", async () => {
    const reactCatalog = await fixtureReactCatalog(["app-storefront"]);
    const client = reactCatalog.files.find((file) => file.uri.endsWith("settings/page.tsx"));
    const server = reactCatalog.files.find((file) => file.uri.includes("checkout/page.tsx"));
    expect(client?.moduleBoundary).toBe("client");
    expect(server?.moduleBoundary).toBe("server");
  });

  it("marks pages router files as unknown", async () => {
    const reactCatalog = await fixtureReactCatalog(["pages-storefront"]);
    const page = reactCatalog.files.find((file) => file.uri.endsWith("about.tsx"));
    expect(page?.moduleBoundary).toBe("unknown");
  });
});
