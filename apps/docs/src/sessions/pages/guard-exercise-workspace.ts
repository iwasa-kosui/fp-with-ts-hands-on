import { guardInitialFile, guardVisibleFiles } from "../../code-explorer/guard-paths";
import type { ProjectFiles, SessionWorkspace } from "../../code-explorer/types";
import type { ExampleSnapshot } from "../types";

export const guardExerciseWorkspaceFor = <Snapshot extends ExampleSnapshot>(
  { slug, snapshot }: Readonly<{ slug: string; snapshot: Snapshot }>,
  projectFiles: ProjectFiles,
  description: string,
): SessionWorkspace<Snapshot> => {
  const visibleFiles = guardVisibleFiles(projectFiles);
  return {
    slug,
    snapshot,
    description,
    initialFile: guardInitialFile(visibleFiles),
    visibleFiles,
  };
};
