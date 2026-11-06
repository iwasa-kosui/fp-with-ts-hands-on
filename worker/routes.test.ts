import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { redirectRoutes, resolveWorkerRoute } from "./routes";

const repositoryRoot = resolve(process.cwd(), "../..");
const pagesDirectory = resolve(repositoryRoot, "apps/docs/src/pages");

const pageExists = (location: string): boolean => {
  const route = location.replace(/^\/+|\/+$/g, "");
  const candidates =
    route === ""
      ? ["index.astro"]
      : [`${route}.astro`, `${route}/index.astro`];
  return candidates.some((candidate) =>
    existsSync(resolve(pagesDirectory, candidate)),
  );
};

describe("resolveWorkerRoute", () => {
  it("keeps health checks in the worker", () => {
    expect(resolveWorkerRoute("/healthz")).toEqual({ kind: "health" });
  });

  it.each(redirectRoutes)(
    "redirects $pathname to $location",
    ({ pathname, location }) => {
      expect(resolveWorkerRoute(pathname)).toEqual({
        kind: "redirect",
        location,
      });
    },
  );

  it("delegates static pages to assets", () => {
    expect(
      resolveWorkerRoute("/sessions/01-business-events-and-workflows/"),
    ).toEqual({
      kind: "asset",
    });
  });
});

describe("redirectRoutes", () => {
  it.each(redirectRoutes)(
    "points $pathname at an existing page",
    ({ location }) => {
      expect(pageExists(location), location).toBe(true);
    },
  );

  it("never redirects to another redirect source", () => {
    const pathnames = new Set<string>(
      redirectRoutes.map(({ pathname }) => pathname),
    );
    const chained = redirectRoutes.filter(({ location }) =>
      pathnames.has(location),
    );
    expect(chained).toEqual([]);
  });
});
