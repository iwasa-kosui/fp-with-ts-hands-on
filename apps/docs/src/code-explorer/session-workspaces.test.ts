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
    ...sessions.flatMap(({ snapshot }) =>
      snapshot === undefined ? [] : [snapshot],
    ),
    "session-07",
  ]),
];

const nextSnapshotFor = (snapshot: ExampleSnapshot): ExampleSnapshot => {
  const next = {
    "session-02": "session-03",
    "session-03": "session-04",
    "session-04": "session-05",
    "session-05": "session-06",
    "session-06": "session-07",
  } as const;
  const result = next[snapshot as keyof typeof next];
  if (result === undefined) throw new Error(`No solution snapshot for ${snapshot}`);
  return result;
};

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
  it("maps S0, S2-S6, and Final to their snapshots without an S1 workspace", () => {
    for (const session of sessions) {
      if (session.kind === "workshop") continue;
      expect(sessionWorkspaceFor(session.slug).snapshot).toBe(session.snapshot);
    }

    expect(() =>
      sessionWorkspaceFor("01-business-events-and-workflows"),
    ).toThrow(
      "Unknown session workspace: 01-business-events-and-workflows",
    );
  });

  it("keeps initial and target files visible without duplicates", () => {
    for (const session of sessions) {
      if (session.kind === "workshop") continue;
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

  it("mounts starter source rather than the next snapshot's solution for every target", () => {
    for (const session of sessions) {
      if (session.kind !== "exercise") continue;
      const starterFiles = projectFilesFor(session.slug);
      const solutionSnapshot = nextSnapshotFor(session.snapshot);
      const solutionFiles = projectFilesForSnapshot(solutionSnapshot);
      for (const step of session.steps) {
        for (const targetPath of step.targets) {
          const target = relativeToSnapshot(session.snapshot, targetPath);
          expect(starterFiles[target]).toEqual(expect.any(String));
          expect(solutionFiles[target]).toEqual(expect.any(String));
          expect(starterFiles[target]).not.toBe(solutionFiles[target]);
        }
      }
    }
  });

  it("builds project-file maps for public snapshots and the private S6 solution", () => {
    expect(snapshots).toEqual([
      "session-00",
      "session-02",
      "session-03",
      "session-04",
      "session-05",
      "session-06",
      "final",
      "session-07",
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
      snapshot: "session-06" as const,
      entrypoint: "exercises/effects-and-events.test.ts",
    },
    {
      snapshot: "session-07" as const,
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
