import { describe, expect, it } from "vitest";
import type {
  ExerciseSessionSummary,
  PublicCodeExplorerSnapshot,
} from "../sessions/types";
import { projectFilesForSnapshot } from "./project-files";
import type { SessionWorkspace } from "./types";

type ExercisePageModule = Readonly<{
  session?: ExerciseSessionSummary;
  workspace?: SessionWorkspace<PublicCodeExplorerSnapshot>;
}>;

const pageModules = import.meta.glob<ExercisePageModule>(
  "../pages/sessions/*.astro",
  { eager: true },
);
const exercisePages = Object.values(pageModules)
  .flatMap(({ session, workspace }) =>
    session === undefined || workspace === undefined
      ? []
      : [{ session, workspace }],
  )
  .sort((left, right) =>
    left.workspace.slug.localeCompare(right.workspace.slug),
  );

const projectSnapshots = [
  "session-00",
  ...exercisePages.map(({ workspace }) => workspace.snapshot),
  "final",
  "session-07",
] as const;

describe("Code Explorer project files", () => {
  it("builds runtime files for page-owned workspaces and supporting snapshots", () => {
    expect(projectSnapshots).toEqual([
      "session-00",
      "session-02",
      "session-03",
      "session-04",
      "session-05",
      "session-06",
      "final",
      "session-07",
    ]);

    for (const snapshot of projectSnapshots) {
      const files = projectFilesForSnapshot(snapshot);
      expect(files["package.json"], snapshot).toEqual(expect.any(String));
      expect(files["tsconfig.json"], snapshot).toEqual(expect.any(String));
      expect(files["vitest.config.ts"], snapshot).toEqual(expect.any(String));
    }
  });

  it("provides every file exposed by an exercise page workspace", () => {
    expect(exercisePages).toHaveLength(5);

    for (const { session, workspace } of exercisePages) {
      const files = projectFilesForSnapshot(workspace.snapshot);

      expect(workspace.slug).toBe(session.slug);
      expect(workspace.snapshot).toBe(session.snapshot);
      expect(workspace.visibleFiles).toContain(workspace.initialFile);
      expect(new Set(workspace.visibleFiles).size).toBe(
        workspace.visibleFiles.length,
      );
      for (const visibleFile of workspace.visibleFiles) {
        expect(files[visibleFile], `${workspace.slug}: ${visibleFile}`).toEqual(
          expect.any(String),
        );
      }
    }
  });
});
