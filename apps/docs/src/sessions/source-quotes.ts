import { projectFilesForSnapshot } from "../code-explorer/project-files";
import type { ProjectFiles } from "../code-explorer/types";
import type { ExampleSnapshot } from "./types";

export const sourceOf = (files: ProjectFiles, path: string): string => {
  const source = files[path];
  if (source === undefined) throw new Error(`${path} is not in the snapshot`);
  return source.trimEnd();
};

const blockRangeOf = (
  files: ProjectFiles,
  path: string,
  firstLine: string,
  lastLine: string,
): Readonly<{ lines: readonly string[]; start: number; end: number }> => {
  const lines = sourceOf(files, path).split("\n");
  const start = lines.indexOf(firstLine);
  const end = lines.indexOf(lastLine, start);
  if (start < 0 || end < 0) {
    throw new Error(`${path} has no block from "${firstLine}" to "${lastLine}"`);
  }
  return { lines, start, end };
};

// 行番号ではなく定義の先頭と末尾で切り出し、実コードの移動に追従する
export const blockOf = (
  files: ProjectFiles,
  path: string,
  firstLine: string,
  lastLine: string,
): string => {
  const { lines, start, end } = blockRangeOf(files, path, firstLine, lastLine);
  return lines.slice(start, end + 1).join("\n");
};

export const pathLabelOf = (snapshot: ExampleSnapshot, path: string): string => {
  sourceOf(projectFilesForSnapshot(snapshot), path);
  return `examples/${snapshot}/${path}`;
};

export const lineLabelOf = (
  snapshot: ExampleSnapshot,
  path: string,
  firstLine: string,
  lastLine: string,
): string => {
  const { start, end } = blockRangeOf(projectFilesForSnapshot(snapshot), path, firstLine, lastLine);
  const range = start === end ? `${start + 1}` : `${start + 1}-${end + 1}`;
  return `examples/${snapshot}/${path}:${range}`;
};
