import { describe, expect, it } from "vitest";
import { sessionNavigationItems } from "./navigation";
import { sessionOverviews } from "./overview-map";

type OverviewSlug = keyof typeof sessionOverviews;

const slugs = sessionNavigationItems
  .map(({ slug }) => slug)
  .filter((slug): slug is OverviewSlug => slug !== "00-system-handover");

describe("overview-map", () => {
  it("has a rule for every session in the navigation except Session 00", () => {
    for (const slug of slugs) {
      expect(sessionOverviews[slug]?.rule.trim(), slug).toBeTruthy();
    }
  });

  it("attaches each incident tag to exactly one session", () => {
    const tagged = (incident: string) =>
      Object.entries(sessionOverviews)
        .filter(([, overview]) => overview.incident === incident)
        .map(([slug]) => slug);

    expect(tagged("課題1")).toEqual(["01-state-transitions"]);
    expect(tagged("課題2")).toEqual(["03-boundaries-and-pii"]);
  });

  it("has the same keys as the navigation except Session 00", () => {
    expect(Object.keys(sessionOverviews).sort()).toEqual([...slugs].sort());
  });
});
