import type { ProjectFiles } from "./types";

export type WorkspaceState = Readonly<{
  contents: ProjectFiles;
  visiblePaths: readonly string[];
  selectedPath: string | undefined;
}>;

export type WorkspaceAction =
  | Readonly<{ kind: "select"; path: string }>
  | Readonly<{ kind: "edit"; path: string; contents: string }>
  | Readonly<{ kind: "reset"; path: string; contents: string }>
  | Readonly<{ kind: "external-write"; path: string; contents: string }>
  | Readonly<{ kind: "external-delete"; path: string }>;

const sortPaths = (paths: readonly string[]): readonly string[] =>
  [...new Set(paths)].sort((left, right) => left.localeCompare(right));

export const createWorkspaceState = (
  contents: ProjectFiles,
  visiblePaths: readonly string[],
  selectedPath: string,
): WorkspaceState => {
  const orderedPaths = sortPaths(visiblePaths);
  return {
    contents: { ...contents },
    visiblePaths: orderedPaths,
    selectedPath: orderedPaths.includes(selectedPath)
      ? selectedPath
      : orderedPaths[0],
  };
};

export const canResetFile = (
  projectFiles: ProjectFiles,
  path: string | undefined,
): boolean => path !== undefined && Object.hasOwn(projectFiles, path);

export const reduceWorkspaceState = (
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState => {
  if (action.kind === "select") {
    if (
      action.path === state.selectedPath ||
      !state.visiblePaths.includes(action.path)
    ) {
      return state;
    }
    return { ...state, selectedPath: action.path };
  }

  if (
    action.kind === "edit" ||
    action.kind === "reset" ||
    action.kind === "external-write"
  ) {
    const alreadyVisible = state.visiblePaths.includes(action.path);
    if (state.contents[action.path] === action.contents && alreadyVisible) {
      return state;
    }
    return {
      ...state,
      contents: { ...state.contents, [action.path]: action.contents },
      visiblePaths:
        action.kind === "external-write" && !alreadyVisible
          ? sortPaths([...state.visiblePaths, action.path])
          : state.visiblePaths,
    };
  }

  const wasVisible = state.visiblePaths.includes(action.path);
  const hadContents = Object.hasOwn(state.contents, action.path);
  if (!wasVisible && !hadContents) return state;

  const contents = { ...state.contents };
  delete contents[action.path];
  const visiblePaths = state.visiblePaths.filter(
    (path) => path !== action.path,
  );
  return {
    contents,
    visiblePaths,
    selectedPath:
      state.selectedPath === action.path
        ? visiblePaths[0]
        : state.selectedPath,
  };
};
