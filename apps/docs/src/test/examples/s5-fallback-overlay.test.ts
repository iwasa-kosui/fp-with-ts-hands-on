import { spawn } from "node:child_process";
import { cp, copyFile, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ExerciseStep,
  type SolutionReference,
  sessions,
} from "../../sessions/catalog";

type CommandResult = Readonly<{
  label: string;
  exitCode: number;
  output: string;
}>;

type ResolvedCatalogPath = Readonly<{
  absolutePath: string;
  relativePath: string;
}>;

const repoRoot = resolve(process.cwd(), "../..");
const starterRoot = resolve(repoRoot, "examples/session-05");
const solutionRoot = resolve(repoRoot, "examples/session-06");

const solutionsFor = (
  steps: readonly ExerciseStep[],
): readonly SolutionReference[] =>
  steps.flatMap(({ solutions }) => solutions);

describe("S5 full-file fallback overlay", () => {
  it.each([
    {
      label: "target",
      catalogRoot: starterRoot,
      destinationRoot: resolve(repoRoot, "examples/.s5-overlay-security"),
      catalogPath: "examples/session-05/../outside",
    },
    {
      label: "solution",
      catalogRoot: solutionRoot,
      destinationRoot: solutionRoot,
      catalogPath: "examples/session-06/../outside",
    },
  ])("$label のpath traversalをroot外へ解決しない", ({
    catalogRoot,
    destinationRoot,
    catalogPath,
  }) => {
    expect(() =>
      resolveCatalogPath(catalogRoot, destinationRoot, catalogPath),
    ).toThrow("catalog path escapes root");
  });

  it("catalog targetsだけを次snapshotで置換すると型検査・回帰・exerciseがすべてGREENになる", async () => {
    const overlayRoot = await mkdtemp(resolve(repoRoot, "examples/.s5-overlay-"));

    try {
      await cp(starterRoot, overlayRoot, {
        recursive: true,
        filter: (source) => !source.endsWith("/node_modules"),
      });
      await symlink(resolve(starterRoot, "node_modules"), resolve(overlayRoot, "node_modules"));

      const s5 = sessions.find(
        ({ slug }) => slug === "05-effects-and-consistency",
      );
      expect(s5?.kind).toBe("exercise");
      if (s5?.kind !== "exercise") return;

      const targets = [...new Set(s5.steps.flatMap(({ targets }) => targets))];
      const completedSolutions = solutionsFor(s5.steps).filter(
        ({ presentation }) => presentation === "completed-file",
      );
      const solutionPaths = new Set(completedSolutions.map(({ path }) => path));
      const expectedSolutionPaths = targets.map((target) => {
        const { relativePath } = resolveCatalogPath(starterRoot, solutionRoot, target);
        return `examples/session-06/${relativePath}`;
      });
      expect([...solutionPaths].sort()).toEqual([...new Set(expectedSolutionPaths)].sort());

      for (const target of targets) {
        const destination = resolveCatalogPath(starterRoot, overlayRoot, target);
        const solutionPath = `examples/session-06/${destination.relativePath}`;
        expect(solutionPaths, target).toContain(solutionPath);
        const solution = completedSolutions.find(({ path }) => path === solutionPath);
        expect(solution, target).toBeDefined();
        if (solution === undefined) continue;
        const source = resolveCatalogPath(solutionRoot, solutionRoot, solution.path);
        expect(source.relativePath).toBe(destination.relativePath);
        await mkdir(dirname(destination.absolutePath), { recursive: true });
        await copyFile(source.absolutePath, destination.absolutePath);
      }

      const results = await Promise.all([
        run(
          "typecheck",
          resolve(repoRoot, "node_modules/.bin/tsc"),
          ["--noEmit"],
          overlayRoot,
        ),
        run(
          "regression",
          resolve(starterRoot, "node_modules/.bin/vitest"),
          ["run", "--config", "vitest.config.ts"],
          overlayRoot,
        ),
        run(
          "exercise",
          resolve(starterRoot, "node_modules/.bin/vitest"),
          ["run", "--config", "vitest.exercises.config.ts"],
          overlayRoot,
        ),
      ]);

      expect(
        results.map(({ label, exitCode }) => ({ label, exitCode })),
        results.map(({ label, output }) => `${label}:\n${output}`).join("\n"),
      ).toEqual([
        { label: "typecheck", exitCode: 0 },
        { label: "regression", exitCode: 0 },
        { label: "exercise", exitCode: 0 },
      ]);
    } finally {
      await rm(overlayRoot, { recursive: true, force: true });
    }
  }, 30_000);
});

const resolveCatalogPath = (
  catalogRoot: string,
  destinationRoot: string,
  catalogPath: string,
): ResolvedCatalogPath => {
  if (isAbsolute(catalogPath)) {
    throw new Error(`catalog path escapes root: ${catalogPath}`);
  }
  const relativePath = relative(catalogRoot, resolve(repoRoot, catalogPath));
  assertPathInsideRoot(relativePath, catalogPath);
  const absolutePath = resolve(destinationRoot, relativePath);
  assertPathInsideRoot(relative(destinationRoot, absolutePath), catalogPath);
  return {
    absolutePath,
    relativePath,
  };
};

const assertPathInsideRoot = (relativePath: string, catalogPath: string): void => {
  if (
    isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`)
  ) {
    throw new Error(`catalog path escapes root: ${catalogPath}`);
  }
};

const run = (
  label: string,
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<CommandResult> =>
  new Promise((resolveResult) => {
    const child = spawn(command, args, { cwd });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", (error) => {
      resolveResult({ label, exitCode: 1, output: `${output}\n${error.message}` });
    });
    child.on("close", (exitCode) => {
      resolveResult({ label, exitCode: exitCode ?? 1, output });
    });
  });
