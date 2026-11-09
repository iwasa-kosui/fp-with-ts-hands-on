import { projectFilesForSnapshot } from "../../code-explorer/project-files";
import { sourceOf } from "../../sessions/source-quotes";
import type { ExampleSnapshot } from "../../sessions/types";

export type MiniTreeFile = {
  readonly id: string;
  readonly name: string;
  readonly note?: string;
  readonly snapshot?: ExampleSnapshot;
};
export type MiniTreeGroup = {
  readonly folder: string;
  readonly files: readonly MiniTreeFile[];
  readonly note?: string;
  readonly isNew?: boolean;
};
export type MiniTreeData = { readonly root: string; readonly groups: readonly MiniTreeGroup[] };

export const miniTree = (
  snapshot: ExampleSnapshot,
  prefix: string,
  groups: readonly MiniTreeGroup[],
): MiniTreeData => {
  groups.forEach((group) =>
    group.files.forEach((file) =>
      sourceOf(
        projectFilesForSnapshot(file.snapshot ?? snapshot),
        `${prefix}${group.folder}${file.name}`,
      ),
    ),
  );
  return { root: `examples/${snapshot}/${prefix}`, groups };
};
