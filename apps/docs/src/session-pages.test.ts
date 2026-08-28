import { describe, expect, it } from "vitest";
import type { SessionSummary } from "./sessions/catalog";

type PageModule = Readonly<{ session?: SessionSummary }>;

const pageModules = import.meta.glob<PageModule>("./pages/sessions/*.astro", {
  eager: true,
});
const pageSources = import.meta.glob<string>("./pages/sessions/*.astro", {
  eager: true,
  query: "?raw",
  import: "default",
});

describe("session pages", () => {
  it("keeps each session metadata object with its Astro page", () => {
    const sessions = Object.values(pageModules).map(({ session }) => session);

    expect(sessions).toHaveLength(8);
    expect(sessions.every((session) => session !== undefined)).toBe(true);
  });

  for (const slug of [
    "00-system-handover",
    "01-business-events-and-workflows",
    "final",
  ]) {
    it(`${slug} owns its page chrome`, () => {
      expect(pageSources[`./pages/sessions/${slug}.astro`]).not.toContain(
        "SessionLayout",
      );
    });
  }
});
