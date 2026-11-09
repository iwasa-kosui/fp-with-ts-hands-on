import {
  useCallback,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  casePathFor,
  guardPaths,
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
  children?: ReactNode;
}>;

const tabPathsFor = (
  visiblePaths: readonly string[],
  selectedPath: string | undefined,
): readonly string[] => {
  const fixed = visiblePaths.filter(
    (path) =>
      path === guardPaths.eslintConfig || path.startsWith(guardPaths.mine),
  );
  return selectedPath === undefined || fixed.includes(selectedPath)
    ? fixed
    : [...fixed, selectedPath];
};

const fileListPathsFor = (
  visiblePaths: readonly string[],
  selectedPath: string | undefined,
  listedCaseIds: readonly string[],
): readonly string[] => {
  const listed = [
    ...visiblePaths.filter(
      (path) => path === guardPaths.eslintConfig || path.startsWith(guardPaths.mine),
    ),
    ...listedCaseIds.flatMap((id) => {
      const path = casePathFor(visiblePaths, id);
      return path === undefined ? [] : [path];
    }),
  ];
  return selectedPath === undefined || listed.includes(selectedPath)
    ? listed
    : [...listed, selectedPath];
};

export const GuardExercise = ({
  workspace,
  projectFiles,
  workspaceStore,
  Editor,
  runnerFactory,
  supportsRuntime,
  loadTerminalView,
  guide,
  children,
}: GuardExerciseProps) => {
  const [store] = useState(
    () => workspaceStore ?? createIndexedDbWorkspaceStore(),
  );
  const cases = useMemo(() => readGuardCases(projectFiles), [projectFiles]);
  const [listedCaseIds, setListedCaseIds] = useState<readonly string[]>([]);
  const fileListPaths = useCallback(
    (visiblePaths: readonly string[], selectedPath: string | undefined) =>
      fileListPathsFor(visiblePaths, selectedPath, listedCaseIds),
    [listedCaseIds],
  );

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
        tabPaths={tabPathsFor}
        fileListPaths={fileListPaths}
        renderLayout={(parts: CodeExplorerLayoutParts) => (
          <GuardLayout
            parts={parts}
            store={store}
            slug={workspace.slug}
            projectFiles={projectFiles}
            cases={cases}
            guide={guide}
            onListedCasesChange={setListedCaseIds}
          >
            {children}
          </GuardLayout>
        )}
      />
    </div>
  );
};
