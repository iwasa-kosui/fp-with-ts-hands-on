import { useMemo, useState, type ComponentType } from "react";
import {
  isGuardReadOnlyPath,
  readGuardCases,
} from "../../code-explorer/guard-paths";
import type { TerminalRunner } from "../../code-explorer/runner";
import type { ProjectFiles, SessionWorkspace } from "../../code-explorer/types";
import {
  createIndexedDbWorkspaceStore,
  type GuardWorkspaceStore,
} from "../../code-explorer/workspace-store";
import {
  CodeExplorer,
  type CodeExplorerLayoutParts,
  type EditorProps,
} from "../code-explorer/CodeExplorer";
import type { TerminalView } from "../code-explorer/TerminalPanel";
import type { GuardGuide } from "./CaseList";
import { GuardLayout } from "./GuardLayout";
import "../../styles/guard-exercise.css";

export type GuardExerciseProps = Readonly<{
  workspace: SessionWorkspace;
  projectFiles: ProjectFiles;
  workspaceStore?: GuardWorkspaceStore;
  Editor?: ComponentType<EditorProps>;
  runnerFactory?: () => TerminalRunner;
  supportsRuntime?: () => boolean;
  loadTerminalView?: () => Promise<TerminalView>;
  guide?: GuardGuide;
}>;

export const GuardExercise = ({
  workspace,
  projectFiles,
  workspaceStore,
  Editor,
  runnerFactory,
  supportsRuntime,
  loadTerminalView,
  guide,
}: GuardExerciseProps) => {
  const [store] = useState(
    () => workspaceStore ?? createIndexedDbWorkspaceStore(),
  );
  const cases = useMemo(() => readGuardCases(projectFiles), [projectFiles]);

  return (
    <div
      className="code-playground guard-exercise"
      data-guard-exercise={workspace.slug}
    >
      <CodeExplorer
        workspace={workspace}
        projectFiles={projectFiles}
        workspaceStore={store}
        Editor={Editor}
        runnerFactory={runnerFactory}
        supportsRuntime={supportsRuntime}
        loadTerminalView={loadTerminalView}
        isReadOnlyPath={isGuardReadOnlyPath}
        renderLayout={(parts: CodeExplorerLayoutParts) => (
          <GuardLayout
            parts={parts}
            store={store}
            slug={workspace.slug}
            projectFiles={projectFiles}
            cases={cases}
            guide={guide}
          />
        )}
      />
    </div>
  );
};
