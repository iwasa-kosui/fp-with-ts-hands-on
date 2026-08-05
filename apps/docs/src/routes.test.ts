import { describe, expect, it } from "vitest";
import { moduleBySlug } from "./content/modules";
import { modulePath, normalizePathname, resolveRoute } from "./routes";

describe("pathname routes", () => {
  it("resolves the home pathname", () => {
    expect(resolveRoute("/")).toEqual({ kind: "home", canonicalPath: "/" });
  });

  it.each([
    ["/modules/00-break-the-app", "00-break-the-app", "/modules/00-break-the-app/"],
    ["/modules/00-read-the-incident", "00-read-the-incident", "/modules/00-read-the-incident/"],
    ["/modules/01-state-modeling", "01-state-modeling", "/modules/01-state-modeling/"],
    ["/modules/02-boundary-and-ids", "02-boundary-and-ids", "/modules/02-boundary-and-ids/"],
    ["/modules/03-result-errors", "03-result-errors", "/modules/03-result-errors/"],
    ["/modules/04-agent-review", "04-agent-review", "/modules/04-agent-review/"],
    ["/modules/05-mini-integration", "05-mini-integration", "/modules/05-mini-integration/"],
  ])("resolves %s to its canonical module route", (pathname, slug, canonicalPath) => {
    expect(resolveRoute(pathname)).toMatchObject({
      kind: "module",
      canonicalPath,
      module: { slug },
    });
  });

  it("maps the legacy module-00 pathname to the first module", () => {
    expect(resolveRoute("/module-00/")).toMatchObject({
      kind: "module",
      canonicalPath: "/modules/00-break-the-app/",
      module: { slug: "00-break-the-app" },
    });
  });

  it("normalizes duplicate separators and missing trailing slashes", () => {
    expect(normalizePathname("modules//01-state-modeling")).toBe(
      "/modules/01-state-modeling/",
    );
    expect(resolveRoute("//modules//01-state-modeling//")).toMatchObject({
      kind: "module",
      canonicalPath: "/modules/01-state-modeling/",
      module: { slug: "01-state-modeling" },
    });
  });

  it("returns the normalized pathname for an unknown route", () => {
    expect(resolveRoute("modules//missing")).toEqual({
      kind: "not-found",
      pathname: "/modules/missing/",
    });
  });

  it("builds a canonical path for a registered module", () => {
    const firstModule = moduleBySlug("00-break-the-app");
    expect(firstModule).toBeDefined();
    if (firstModule === undefined) throw new Error("00-break-the-app is missing");

    expect(modulePath(firstModule)).toBe("/modules/00-break-the-app/");
  });
});
