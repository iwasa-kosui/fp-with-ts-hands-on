import { guardInitialFile, guardVisibleFiles } from "../../code-explorer/guard-paths";
import type { ProjectFiles, SessionWorkspace } from "../../code-explorer/types";
import { sessionSlug } from "./03-boundaries-and-pii";

export const guardExerciseSnapshot = "session-03-solution" as const;

export const guardExerciseSlug = sessionSlug;

export const guardExerciseWorkspaceFor = (
  projectFiles: ProjectFiles,
  description: string,
): SessionWorkspace<typeof guardExerciseSnapshot> => {
  const visibleFiles = guardVisibleFiles(projectFiles);
  return {
    slug: guardExerciseSlug,
    snapshot: guardExerciseSnapshot,
    description,
    initialFile: guardInitialFile(visibleFiles),
    visibleFiles,
  };
};
