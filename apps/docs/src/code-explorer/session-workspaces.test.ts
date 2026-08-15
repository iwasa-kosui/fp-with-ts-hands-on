import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  sessions,
  type ExampleSnapshot,
} from "../sessions/catalog";
import * as projectFilesModule from "./project-files";
import { projectFilesFor } from "./project-files";
import { sessionWorkspaceFor } from "./session-workspaces";
import type { ProjectFiles } from "./types";

type SnapshotLoader = (snapshot: ExampleSnapshot) => ProjectFiles;

const projectFilesForSnapshot = (snapshot: ExampleSnapshot): ProjectFiles => {
  const candidate: unknown = Reflect.get(
    projectFilesModule,
    "projectFilesForSnapshot",
  );
  expect(candidate, "projectFilesForSnapshot export").toEqual(expect.any(Function));
  return (candidate as SnapshotLoader)(snapshot);
};

const snapshots = [
  ...new Set<ExampleSnapshot>([
    ...sessions.map(({ snapshot }) => snapshot),
    "session-05",
  ]),
];

const relativeToSnapshot = (snapshot: ExampleSnapshot, repoPath: string): string => {
  const prefix = `examples/${snapshot}/`;
  expect(repoPath.startsWith(prefix), `${repoPath} must start with ${prefix}`).toBe(true);
  return repoPath.slice(prefix.length);
};

const importClosure = (
  files: ProjectFiles,
  entrypoint: string,
): ReadonlySet<string> => {
  const sourceByAbsolutePath = new Map(
    Object.entries(files).map(([file, source]) => [
      path.posix.normalize(`/workspace/${file}`),
      source,
    ]),
  );
  const visited = new Set<string>();

  const visit = (absoluteFile: string): void => {
    if (visited.has(absoluteFile)) return;
    const source = sourceByAbsolutePath.get(absoluteFile);
    expect(source, `missing project source: ${absoluteFile}`).toEqual(expect.any(String));
    visited.add(absoluteFile);

    for (const imported of ts.preProcessFile(source!).importedFiles) {
      const specifier = imported.fileName;
      if (!specifier.startsWith(".")) continue;
      const unresolved = path.posix.resolve(path.posix.dirname(absoluteFile), specifier);
      const candidates = [
        unresolved,
        unresolved.replace(/\.js$/, ".ts"),
        `${unresolved}.ts`,
        path.posix.join(unresolved, "index.ts"),
      ];
      const resolved = candidates.find((candidate) => sourceByAbsolutePath.has(candidate));
      expect(
        resolved,
        `unresolved relative import: ${absoluteFile}:${specifier}`,
      ).toEqual(expect.any(String));
      visit(resolved!);
    }
  };

  visit(path.posix.resolve("/workspace", entrypoint));
  return visited;
};

describe("session code workspaces", () => {
  it("maps the six catalog slugs to their starter snapshots", () => {
    for (const session of sessions) {
      expect(sessionWorkspaceFor(session.slug).snapshot).toBe(session.snapshot);
    }
  });

  it("keeps initial and target files visible without duplicates", () => {
    for (const session of sessions) {
      const workspace = sessionWorkspaceFor(session.slug);
      const files = projectFilesFor(session.slug);

      expect(workspace.visibleFiles).toContain(workspace.initialFile);
      expect(new Set(workspace.visibleFiles).size).toBe(workspace.visibleFiles.length);
      for (const visibleFile of workspace.visibleFiles) {
        expect(files[visibleFile], `${session.slug}: ${visibleFile}`).toEqual(
          expect.any(String),
        );
      }
      for (const step of session.steps) {
        for (const target of step.targets) {
          expect(workspace.visibleFiles).toContain(
            relativeToSnapshot(session.snapshot, target),
          );
        }
      }
    }
  });

  it("mounts starter source rather than the next snapshot's solution", () => {
    for (const session of sessions.filter(({ kind }) => kind === "exercise")) {
      const starterFiles = projectFilesFor(session.slug);
      for (const step of session.steps) {
        const target = relativeToSnapshot(session.snapshot, step.targets[0]!);
        const solutionSnapshot = step.solution.path.split("/")[1] as ExampleSnapshot;
        const solutionPath = relativeToSnapshot(solutionSnapshot, step.solution.path);
        const solutionFiles = projectFilesForSnapshot(solutionSnapshot);

        expect(starterFiles[target]).toEqual(expect.any(String));
        expect(solutionFiles[solutionPath]).toEqual(expect.any(String));
        expect(starterFiles[target]).not.toBe(solutionFiles[solutionPath]);
      }
    }
  });

  it("builds project-file maps for every snapshot including session-05", () => {
    expect(snapshots).toEqual([
      "session-00",
      "session-01",
      "session-02",
      "session-03",
      "session-04",
      "final",
      "session-05",
    ]);
    for (const snapshot of snapshots) {
      const files = projectFilesForSnapshot(snapshot);
      expect(files["package.json"]).toEqual(expect.any(String));
      expect(files["tsconfig.json"]).toEqual(expect.any(String));
      expect(files["vitest.config.ts"]).toEqual(expect.any(String));
    }
  });

  it.each([
    {
      snapshot: "session-04" as const,
      entrypoint: "exercises/effects-and-events.test.ts",
    },
    {
      snapshot: "session-05" as const,
      entrypoint: "test/regression/effects-and-events.test.ts",
    },
  ])(
    "resolves the $snapshot transitive relative import closure through the shared clinic fixture",
    ({ snapshot, entrypoint }) => {
      const closure = importClosure(projectFilesForSnapshot(snapshot), entrypoint);

      expect(closure).toContain("/fixtures/clinic.ts");
    },
  );

  it("rejects unknown public session slugs", () => {
    expect(() => sessionWorkspaceFor("not-a-session")).toThrow(
      "Unknown session workspace: not-a-session",
    );
    expect(() => projectFilesFor("not-a-session")).toThrow(
      "Unknown session project: not-a-session",
    );
  });
});
