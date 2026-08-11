import { describe, expect, it } from "vitest";
import { sessionBySlug, sessionNeighbors, sessionPath, sessions } from "./catalog";

describe("session catalog", () => {
  it("keeps the sessions and final example in workshop order", () => {
    expect(sessions.map(({ slug }) => slug)).toEqual([
      "00-onboarding",
      "01-invariants",
      "02-state-vocabulary",
      "03-state-transitions",
      "04-awaiting-payment",
      "05-cancellation",
      "06-input-boundary",
      "07-meaningful-values",
      "08-pii-output",
      "09-typed-failures",
      "10-success-events",
      "11-use-case-ports",
      "12-atomicity-and-conflicts",
      "13-safe-follow-up",
      "final",
    ]);
  });

  it("uses unique slugs and sequence labels", () => {
    expect(new Set(sessions.map(({ slug }) => slug)).size).toBe(sessions.length);
    expect(new Set(sessions.map(({ sequence }) => sequence)).size).toBe(sessions.length);
  });

  it("resolves paths and neighbors", () => {
    const session = sessionBySlug("01-invariants");
    expect(session).toBeDefined();
    expect(session === undefined ? undefined : sessionPath(session)).toBe(
      "/sessions/01-invariants/",
    );
    expect(sessionNeighbors("01-invariants")).toEqual({
      previous: sessions[0],
      next: sessions[2],
    });
    expect(sessionNeighbors("13-safe-follow-up")).toEqual({
      previous: sessions[12],
      next: sessions[14],
    });
    expect(sessionNeighbors("final")).toEqual({
      previous: sessions[13],
    });
  });
});
