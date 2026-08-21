import { describe, expect, it } from "vitest";
import { sessions, type ExampleSnapshot } from "../sessions/catalog";
import { projectFilesFor, projectFilesForSnapshot } from "./project-files";

const projectSnapshots = [
  "session-00",
  "session-02",
  "session-03",
  "session-04",
  "session-05",
  "session-06",
  "final",
  "session-07",
] as const satisfies readonly ExampleSnapshot[];

describe("Code Explorer project files", () => {
  it("uses only catalog snapshots that have a public Code Explorer", () => {
    expect(
      sessions.flatMap(({ snapshot }) =>
        snapshot === undefined ? [] : [snapshot],
      ),
    ).toEqual(projectSnapshots.slice(0, -1));
  });

  it("builds runtime files for public snapshots and the private S6 solution", () => {
    for (const snapshot of projectSnapshots) {
      const files = projectFilesForSnapshot(snapshot);
      expect(files["package.json"], snapshot).toEqual(expect.any(String));
      expect(files["tsconfig.json"], snapshot).toEqual(expect.any(String));
      expect(files["vitest.config.ts"], snapshot).toEqual(expect.any(String));
    }
  });

  it("rejects the S1 workshop instead of creating a fake workspace", () => {
    expect(() => projectFilesFor("01-business-events-and-workflows")).toThrow(
      "Unknown session project: 01-business-events-and-workflows",
    );
  });
});
