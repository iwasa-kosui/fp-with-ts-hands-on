import { projectFilesForSnapshot } from "../../code-explorer/project-files";
import { sourceOf } from "../../sessions/source-quotes";
import type { ExampleSnapshot } from "../../sessions/types";

const dedent = (lines: readonly string[]): string => {
  const indent = Math.min(
    ...lines.filter((line) => line.trim() !== "").map((line) => line.length - line.trimStart().length),
  );
  return lines.map((line) => line.slice(indent)).join("\n");
};

export const quote = (
  snapshot: ExampleSnapshot,
  path: string,
  from: string,
  to: string = from,
): string => {
  const lines = sourceOf(projectFilesForSnapshot(snapshot), path).split("\n");
  const start = lines.findIndex((line) => line.trim() === from);
  const end = lines.findIndex((line, index) => index >= start && line.trim() === to);
  if (start < 0 || end < 0) {
    throw new Error(`${snapshot}/${path} has no block from "${from}" to "${to}"`);
  }
  return dedent(lines.slice(start, end + 1));
};

export const quoteRows = (
  snapshot: ExampleSnapshot,
  path: string,
  firstRows: readonly string[],
): readonly string[] => {
  const lines = sourceOf(projectFilesForSnapshot(snapshot), path).split("\n");
  const start = lines.findIndex((line) => line.trim() === firstRows[0]);
  if (start < 0) throw new Error(`${snapshot}/${path} has no line "${firstRows[0]}"`);
  const rows = firstRows.map((row, index) => {
    const line = lines[start + index];
    if (line === undefined || line.trim() !== row) {
      throw new Error(`${snapshot}/${path} line ${start + index + 1} is not "${row}"`);
    }
    return line;
  });
  const indent = Math.min(...rows.map((row) => row.length - row.trimStart().length));
  return rows.map((row) => row.slice(indent));
};
