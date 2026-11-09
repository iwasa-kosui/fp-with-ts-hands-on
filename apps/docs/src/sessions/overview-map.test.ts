import { describe, expect, it } from "vitest";
import { sessionNavigationItems } from "./navigation";
import { sessionOverviews, stages } from "./overview-map";

const slugs = sessionNavigationItems.map(({ slug }) => slug);

describe("overview-map", () => {
  it("has a description for every session in the navigation", () => {
    for (const slug of slugs) {
      expect(sessionOverviews[slug]?.summary.trim(), slug).toBeTruthy();
    }
  });

  it("has no description for a slug outside the navigation", () => {
    const extra = Object.keys(sessionOverviews).filter((slug) => !slugs.some((known) => known === slug));

    expect(extra).toEqual([]);
  });

  it("fills only stages that are defined", () => {
    const stageIds = stages.map(({ id }) => id);

    for (const slug of slugs) {
      for (const stageId of sessionOverviews[slug].fills) {
        expect(stageIds, `${slug}: ${stageId}`).toContain(stageId);
      }
    }
  });

  it("assigns each of the problems 1 to 8 to exactly one session", () => {
    const fixed = slugs.flatMap((slug) => sessionOverviews[slug].fixes).sort((a, b) => a - b);

    expect(fixed).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("marks only fixed problems as advanced", () => {
    for (const slug of slugs) {
      const { fixes, advancedFixes = [] } = sessionOverviews[slug];

      for (const problem of advancedFixes) {
        expect(fixes, `${slug}: ${problem}`).toContain(problem);
      }
    }
  });
});
