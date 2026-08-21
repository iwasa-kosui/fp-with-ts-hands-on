import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";

type Measurement = Readonly<{ files: number; lines: number }>;

const repoRoot = resolve(process.cwd(), "../..");
const expectedMeasurements = new Map([
  ["02-state-transitions", { files: 2, lines: 35 }],
  ["03-semantic-identifiers", { files: 5, lines: 34 }],
  ["04-boundaries-and-pii", { files: 2, lines: 26 }],
  ["05-workflow-errors", { files: 3, lines: 76 }],
  ["06-effects-and-consistency", { files: 3, lines: 55 }],
] as const);

describe("exercise diff budgets", () => {
  it("13. records measured module diffs within the five-file and 80-line limits", async () => {
    const exercises = sessions.filter((session) => session.kind === "exercise");
    expect(exercises).toHaveLength(5);

    for (const session of exercises) {
      const nextSnapshot = session.solutionSnapshot;

      const modulePath = session.exerciseModule.dir.replace(`examples/${session.snapshot}/`, "");
      const actual = await measureDiff(
        resolve(repoRoot, session.exerciseModule.dir),
        resolve(repoRoot, "examples", nextSnapshot, modulePath),
      );
      const diagnostic = `${session.slug}: ${actual.files} files / ${actual.lines} effective lines`;

      expect(actual, diagnostic).toEqual(expectedMeasurements.get(session.slug));
      expect(actual.files, diagnostic).toBe(session.exerciseModule.fileBudget);
      expect(actual.lines, diagnostic).toBe(session.exerciseModule.lineBudget);
      expect(actual.files, diagnostic).toBeLessThanOrEqual(5);
      expect(actual.lines, diagnostic).toBeLessThanOrEqual(80);
      expect(session.steps.length, diagnostic).toBeLessThanOrEqual(4);
      expect(session.decisions.length, diagnostic).toBeLessThanOrEqual(3);
      for (const step of session.steps) {
        expect(
          new Set(step.solutions.map(({ symbol }) => symbol)).size,
          `${session.slug}: ${step.id}`,
        ).toBeLessThanOrEqual(2);
      }
      for (const target of session.steps.flatMap(({ targets }) => targets)) {
        expect(target.startsWith(`${session.exerciseModule.dir}/`), diagnostic).toBe(true);
      }
    }
  });
});

const measureDiff = async (beforeDir: string, afterDir: string): Promise<Measurement> => {
  const relativePaths = new Set([
    ...(await listFiles(beforeDir)).map((path) => relative(beforeDir, path)),
    ...(await listFiles(afterDir)).map((path) => relative(afterDir, path)),
  ]);
  let files = 0;
  let lines = 0;

  for (const path of relativePaths) {
    const before = await readOrEmpty(resolve(beforeDir, path));
    const after = await readOrEmpty(resolve(afterDir, path));
    const changedLines = countEffectiveAddedLines(before, after);
    if (changedLines === 0) continue;
    files += 1;
    lines += changedLines;
  }

  return { files, lines };
};

const listFiles = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? listFiles(path) : Promise.resolve([path]);
      }),
    )
  ).flat();
};

const readOrEmpty = async (path: string): Promise<string> =>
  readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });

const countEffectiveAddedLines = (before: string, after: string): number => {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const common = Array.from({ length: oldLines.length + 1 }, () =>
    Array<number>(newLines.length + 1).fill(0),
  );

  for (let oldIndex = 1; oldIndex <= oldLines.length; oldIndex += 1) {
    for (let newIndex = 1; newIndex <= newLines.length; newIndex += 1) {
      common[oldIndex]![newIndex] =
        oldLines[oldIndex - 1] === newLines[newIndex - 1]
          ? common[oldIndex - 1]![newIndex - 1]! + 1
          : Math.max(common[oldIndex - 1]![newIndex]!, common[oldIndex]![newIndex - 1]!);
    }
  }

  let oldIndex = oldLines.length;
  let newIndex = newLines.length;
  let count = 0;
  while (newIndex > 0) {
    if (oldIndex > 0 && oldLines[oldIndex - 1] === newLines[newIndex - 1]) {
      oldIndex -= 1;
      newIndex -= 1;
    } else if (oldIndex > 0 && common[oldIndex - 1]![newIndex]! > common[oldIndex]![newIndex - 1]!) {
      oldIndex -= 1;
    } else {
      const line = newLines[newIndex - 1]!.trim();
      if (line !== "" && !/^(?:\/\/|\/\*|\*|\*\/)/.test(line)) count += 1;
      newIndex -= 1;
    }
  }
  return count;
};
