import { describe, expect, it } from "vitest";
import type { SessionSummary } from "./sessions/catalog";

type PageModule = Readonly<{ session?: SessionSummary }>;

const pageModules = import.meta.glob<PageModule>("./pages/sessions/*.astro", {
  eager: true,
});

describe("session pages", () => {
  it("keeps each session metadata object with its Astro page", () => {
    const sessions = Object.values(pageModules).map(({ session }) => session);

    expect(sessions).toHaveLength(8);
    expect(sessions.every((session) => session !== undefined)).toBe(true);
  });
});
