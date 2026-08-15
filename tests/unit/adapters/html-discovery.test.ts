import { describe, expect, it } from "vitest";
import {
  discoverHtmlRoutes,
  htmlRelativePathToRoute,
} from "@a11yst/adapters";
import { adapterFixture } from "../../helpers/adapters.js";

describe("html route discovery", () => {
  it("maps html files to route paths", () => {
    expect(htmlRelativePathToRoute("index.html")).toBe("/");
    expect(htmlRelativePathToRoute("about.html")).toBe("/about.html");
    expect(htmlRelativePathToRoute("about/index.html")).toBe("/about/");
    expect(htmlRelativePathToRoute("docs/guide/index.html")).toBe("/docs/guide/");
  });

  it("discovers routes from fixture project", () => {
    const result = discoverHtmlRoutes(adapterFixture("html"));
    expect(result.routes.map((route) => route.path).sort()).toEqual([
      "/",
      "/about.html",
      "/about/",
      "/docs/guide/",
    ]);
    expect(result.routes.every((route) => route.origin === "filesystem")).toBe(true);
  });
});
