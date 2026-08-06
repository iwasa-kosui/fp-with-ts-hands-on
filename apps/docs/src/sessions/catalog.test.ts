import { describe, expect, it } from "vitest";
import { sessionBySlug, sessionNeighbors, sessionPath, sessions } from "./catalog";

describe("session catalog", () => {
  it("keeps the seven sessions in workshop order", () => {
    expect(sessions.map(({ slug }) => slug)).toEqual([
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
    expect(new Set(sessions.map(({ slug }) => slug)).size).toBe(sessions.length);
    expect(new Set(sessions.map(({ sequence }) => sequence)).size).toBe(sessions.length);
  });

  it("resolves paths and neighbors", () => {
    const session = sessionBySlug("01-state-modeling");
    expect(session).toBeDefined();
    expect(session === undefined ? undefined : sessionPath(session)).toBe(
      "/sessions/01-state-modeling/",
    );
    expect(sessionNeighbors("01-state-modeling")).toEqual({
      previous: sessions[1],
      next: sessions[3],
    });
  });
});
