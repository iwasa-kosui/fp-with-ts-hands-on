import type { ProjectFiles } from "./types";
import type { SavedEdit } from "./workspace-store";
import { sortPaths } from "./workspace-state";

export type AppliedSavedEdits = Readonly<{
  contents: ProjectFiles;
  visiblePaths: readonly string[];
  outdatedPaths: readonly string[];
}>;

const baseOf = (projectFiles: ProjectFiles, path: string): string | null =>
  Object.hasOwn(projectFiles, path) ? (projectFiles[path] ?? null) : null;

export const computeEdits = (
  contents: ProjectFiles,
  projectFiles: ProjectFiles,
): Record<string, SavedEdit> => {
  const edits: Record<string, SavedEdit> = {};
  for (const [path, value] of Object.entries(contents)) {
    if (Object.hasOwn(projectFiles, path) && projectFiles[path] === value) {
      continue;
    }
    edits[path] = { contents: value, base: baseOf(projectFiles, path) };
  }
  for (const path of Object.keys(projectFiles)) {
    if (!Object.hasOwn(contents, path)) {
      edits[path] = { contents: null, base: baseOf(projectFiles, path) };
    }
  }
  return edits;
};

export const serializeEdits = (edits: Readonly<Record<string, SavedEdit>>) =>
  JSON.stringify(
    Object.entries(edits).sort(([left], [right]) => (left < right ? -1 : 1)),
  );

const applyEdits = (
  projectFiles: ProjectFiles,
  visiblePaths: readonly string[],
  edits: Readonly<Record<string, SavedEdit>>,
  includeOutdated: boolean,
): AppliedSavedEdits => {
  const contents: Record<string, string> = { ...projectFiles };
  let visible = [...visiblePaths];
  const outdatedPaths: string[] = [];

  for (const [path, edit] of Object.entries(edits)) {
    if (edit.base !== baseOf(projectFiles, path)) {
      outdatedPaths.push(path);
      if (!includeOutdated) continue;
    }
    if (edit.contents === null) {
      delete contents[path];
      visible = visible.filter((visiblePath) => visiblePath !== path);
    } else {
      contents[path] = edit.contents;
      visible.push(path);
    }
  }

  return { contents, visiblePaths: sortPaths(visible), outdatedPaths };
};

export const applySavedEdits = (
  projectFiles: ProjectFiles,
  visiblePaths: readonly string[],
  edits: Readonly<Record<string, SavedEdit>>,
): AppliedSavedEdits => applyEdits(projectFiles, visiblePaths, edits, false);

export const applyAllSavedEdits = (
  projectFiles: ProjectFiles,
  visiblePaths: readonly string[],
  edits: Readonly<Record<string, SavedEdit>>,
): AppliedSavedEdits => applyEdits(projectFiles, visiblePaths, edits, true);

export const trimTerminalOutput = (output: string, limit = 200_000): string => {
  if (output.length <= limit) return output;
  const tail = output.slice(-limit);
  const lineBreak = tail.indexOf("\n");
  return lineBreak === -1 ? tail : tail.slice(lineBreak + 1);
};
