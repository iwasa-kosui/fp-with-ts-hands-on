import { describe, expect, it } from "vitest";
import { moduleBySlug, moduleNeighbors, modulePath, modules } from "./catalog";

describe("module catalog", () => {
  it("keeps the seven modules in workshop order", () => {
    expect(modules.map(({ slug }) => slug)).toEqual([
      "00-break-the-app",
      "00-read-the-incident",
      "01-state-modeling",
      "02-boundary-and-ids",
      "03-result-errors",
      "04-agent-review",
      "05-mini-integration",
    ]);
  });

  it("uses unique slugs and sequence labels", () => {
    expect(new Set(modules.map(({ slug }) => slug)).size).toBe(modules.length);
    expect(new Set(modules.map(({ sequence }) => sequence)).size).toBe(modules.length);
  });

  it("resolves paths and neighbors", () => {
    const module = moduleBySlug("01-state-modeling");
    expect(module).toBeDefined();
    expect(module === undefined ? undefined : modulePath(module)).toBe(
      "/modules/01-state-modeling/",
    );
    expect(moduleNeighbors("01-state-modeling")).toMatchObject({
      previous: { slug: "00-read-the-incident" },
      next: { slug: "02-boundary-and-ids" },
    });
  });
});
