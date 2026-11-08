import { guardInitialFile, guardVisibleFiles } from "../../code-explorer/guard-paths";
import type { ProjectFiles, SessionWorkspace } from "../../code-explorer/types";
import type { ExampleSnapshot } from "../types";

const guardRoot = "exercises/guard/";

export const guardExerciseWorkspaceFor = <Snapshot extends ExampleSnapshot>(
  { slug, snapshot }: Readonly<{ slug: string; snapshot: Snapshot }>,
  projectFiles: ProjectFiles,
  description: string,
): SessionWorkspace<Snapshot> => {
  if (!Object.keys(projectFiles).some((path) => path.startsWith(guardRoot))) {
    throw new Error(`Snapshot ${snapshot} has no files under ${guardRoot}`);
  }
  const visibleFiles = guardVisibleFiles(projectFiles);
  return {
    slug: `guard-exercise:${slug}`,
    snapshot,
    description,
    initialFile: guardInitialFile(visibleFiles),
    visibleFiles,
  };
};
