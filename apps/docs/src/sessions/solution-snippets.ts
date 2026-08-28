import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ExerciseStep, SolutionReference } from "./catalog";

export const loadSolutionSnippets = async (
  step: ExerciseStep,
): Promise<
  readonly Readonly<{ solution: SolutionReference; code: string }>[]
> => {
  const presentations = new Set(
    step.solutions.map(({ presentation }) => presentation ?? "excerpt"),
  );
  if (presentations.size !== 1) {
    throw new Error(`1ステップ内の表示形式を統一してください: ${step.id}`);
  }

  return Promise.all(
    step.solutions.map(async (solution) => {
      const [start, end] = solution.lines;
      if (!Number.isInteger(start) || start < 1) {
        throw new Error(`開始行は1以上で指定してください: ${solution.path}`);
      }
      if (!Number.isInteger(end) || end < start) {
        throw new Error(
          `終了行は開始行以降で指定してください: ${solution.path}`,
        );
      }

      const source = await readFile(
        resolve(process.cwd(), "../..", solution.path),
        "utf8",
      );
      const sourceLines = source.split("\n");
      if (end > sourceLines.length) {
        throw new Error(
          `指定行がソースの範囲外です: ${solution.path}:${start}-${end}`,
        );
      }
      const code = sourceLines.slice(start - 1, end).join("\n");
      if (code.trim() === "") {
        throw new Error(
          `指定範囲のコードが空です: ${solution.path}:${start}-${end}`,
        );
      }
      return { solution, code };
    }),
  );
};
