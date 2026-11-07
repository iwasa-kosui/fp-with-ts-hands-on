import type { ProjectFiles } from "../code-explorer/types";

export const sourceOf = (files: ProjectFiles, path: string): string => {
  const source = files[path];
  if (source === undefined) throw new Error(`${path} is not in the snapshot`);
  return source.trimEnd();
};

// 行番号ではなく定義の先頭と末尾で切り出し、実コードの移動に追従する
export const blockOf = (
  files: ProjectFiles,
  path: string,
  firstLine: string,
  lastLine: string,
): string => {
  const lines = sourceOf(files, path).split("\n");
  const start = lines.indexOf(firstLine);
  const end = lines.indexOf(lastLine, start);
  if (start < 0 || end < 0) {
    throw new Error(`${path} has no block from "${firstLine}" to "${lastLine}"`);
  }
  return lines.slice(start, end + 1).join("\n");
};
