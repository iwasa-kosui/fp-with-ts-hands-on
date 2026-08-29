import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import type {
  ExampleSnapshot,
  ExerciseSessionSummary,
  PublicCodeExplorerSnapshot,
} from "../sessions/types";
import {
  browserPackageJsonFor,
  projectFilesForSnapshot,
} from "./project-files";
import type { ProjectFiles, SessionWorkspace } from "./types";

type ExercisePageModule = Readonly<{
  session?: ExerciseSessionSummary;
  workspace?: SessionWorkspace<PublicCodeExplorerSnapshot>;
}>;

const pageModules = import.meta.glob<ExercisePageModule>([
  "../pages/sessions/*.astro",
  "!../pages/sessions/index.astro",
], {
  eager: true,
});
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

const relativeToSnapshot = (
  snapshot: ExampleSnapshot,
  repoPath: string,
): string => {
  const prefix = `examples/${snapshot}/`;
  expect(repoPath.startsWith(prefix), `${repoPath} must start with ${prefix}`).toBe(
    true,
  );
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
    expect(source, `missing project source: ${absoluteFile}`).toEqual(
      expect.any(String),
    );
    visited.add(absoluteFile);

    for (const imported of ts.preProcessFile(source!).importedFiles) {
      const specifier = imported.fileName;
      if (!specifier.startsWith(".")) continue;
      const unresolved = path.posix.resolve(
        path.posix.dirname(absoluteFile),
        specifier,
      );
      const candidates = [
        unresolved,
        unresolved.replace(/\.js$/, ".ts"),
        `${unresolved}.ts`,
        path.posix.join(unresolved, "index.ts"),
      ];
      const resolved = candidates.find((candidate) =>
        sourceByAbsolutePath.has(candidate),
      );
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

  it("adds the documented session command to each exercise workspace", () => {
    for (const sequence of ["02", "03", "04", "05", "06"] as const) {
      const packageJson = JSON.parse(
        projectFilesForSnapshot(`session-${sequence}`)["package.json"]!,
      ) as {
        scripts: Record<string, string>;
        devDependencies: Record<string, string>;
      };

      expect(packageJson.scripts[`exercise:${sequence}`]).toBe(
        "pnpm exercise",
      );
      expect(packageJson.devDependencies.typescript).toBe("5.9.3");
    }
  });

  it("omits workspace-only dependencies from browser workspaces", () => {
    for (const snapshot of projectSnapshots) {
      const packageJson = JSON.parse(
        projectFilesForSnapshot(snapshot)["package.json"]!,
      ) as { dependencies?: Record<string, string> };

      expect(
        Object.values(packageJson.dependencies ?? {}).some((version) =>
          version.startsWith("workspace:"),
        ),
        snapshot,
      ).toBe(false);
    }
  });

  it("removes workspace protocols from every installable dependency section", () => {
    expect(
      browserPackageJsonFor({
        dependencies: {
          "local-runtime": "workspace:*",
          runtime: "^1.0.0",
        },
        devDependencies: {
          "local-tool": "workspace:^",
          tool: "^2.0.0",
        },
        optionalDependencies: {
          "local-optional": "workspace:~",
          optional: "^3.0.0",
        },
        peerDependencies: {
          "local-peer": "workspace:*",
          peer: "^4.0.0",
        },
      }),
    ).toEqual({
      dependencies: { runtime: "^1.0.0" },
      devDependencies: { tool: "^2.0.0" },
      optionalDependencies: { optional: "^3.0.0" },
      peerDependencies: { peer: "^4.0.0" },
    });
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

  it("exposes semantic identifiers from their owning concepts", () => {
    const expectedPaths = {
      "03-semantic-identifiers": [
        "src/domain/appointment/appointmentId.ts",
        "src/domain/appointment/veterinarianId.ts",
      ],
      "04-boundaries-and-pii": [
        "src/domain/appointment/appointmentId.ts",
        "src/domain/appointment/veterinarianId.ts",
      ],
      "05-workflow-errors": [
        "src/domain/appointment/appointmentId.ts",
        "src/domain/appointment/veterinarianId.ts",
        "src/domain/examResult/examId.ts",
        "src/domain/owner/ownerId.ts",
        "src/domain/pet/petId.ts",
      ],
    } as const;

    for (const [slug, paths] of Object.entries(expectedPaths)) {
      const workspace = exercisePages.find((page) => page.workspace.slug === slug)?.workspace;
      expect(workspace, slug).toEqual(expect.any(Object));
      expect(workspace!.visibleFiles).toEqual(expect.arrayContaining([...paths]));
      expect(workspace!.visibleFiles.some((path) => path.startsWith("src/domain/ids/"))).toBe(false);
    }
  });

  it("keeps every exercise target different between starter and solution snapshots", () => {
    for (const { session, workspace } of exercisePages) {
      const starterFiles = projectFilesForSnapshot(workspace.snapshot);
      const solutionSnapshot = session.solutionSnapshot;
      expect(solutionSnapshot, session.slug).not.toBe("session-01");
      if (solutionSnapshot === "session-01") continue;
      const solutionFiles = projectFilesForSnapshot(solutionSnapshot);

      for (const step of session.steps) {
        for (const targetPath of step.targets) {
          const target = relativeToSnapshot(session.snapshot, targetPath);
          expect(starterFiles[target], `${session.slug}: ${target}`).toEqual(
            expect.any(String),
          );
          expect(solutionFiles[target], `${solutionSnapshot}: ${target}`).toEqual(
            expect.any(String),
          );
          expect(starterFiles[target], `${session.slug}: ${target}`).not.toBe(
            solutionFiles[target],
          );
        }
      }
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
    "resolves the $snapshot relative-import closure through the shared clinic fixture",
    ({ snapshot, entrypoint }) => {
      const closure = importClosure(
        projectFilesForSnapshot(snapshot),
        entrypoint,
      );

      expect(closure).toContain("/fixtures/clinic.ts");
    },
  );
});
