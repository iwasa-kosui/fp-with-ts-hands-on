import {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentType,
} from "react";
import type {
  TerminalRunner,
  TerminalSession,
  WorkspaceChange,
} from "../../code-explorer/runner";
import type { CodeGuide, CodeHighlight } from "../../code-explorer/code-guide";
import type { ProjectFiles, SessionWorkspace } from "../../code-explorer/types";
import {
  canResetFile,
  createWorkspaceState,
  reduceWorkspaceState,
} from "../../code-explorer/workspace-state";
import { FileTree } from "./FileTree";
import { MonacoEditor } from "./MonacoEditor";
import {
  TerminalPanel,
  type TerminalPanelStateKind,
  type TerminalView,
} from "./TerminalPanel";
import "@xterm/xterm/css/xterm.css";

export type EditorProps = Readonly<{
  path: string;
  value: string;
  files: ProjectFiles;
  typeFiles: ProjectFiles;
  disabled: boolean;
  readOnly: boolean;
  highlights: readonly CodeHighlight[];
  onChange: (value: string) => void;
}>;

export type CodeExplorerProps = Readonly<{
  workspace: SessionWorkspace;
  projectFiles: ProjectFiles;
  guides?: readonly CodeGuide[];
  Editor?: ComponentType<EditorProps>;
  runnerFactory?: () => TerminalRunner;
  supportsRuntime?: () => boolean;
  loadTerminalView?: () => Promise<TerminalView>;
}>;

const noHighlights: readonly CodeHighlight[] = [];

const messageFrom = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "ファイルを実行環境へ反映できませんでした。";

export const CodeExplorer = ({
  workspace,
  projectFiles,
  guides,
  Editor = MonacoEditor,
  runnerFactory,
  supportsRuntime,
  loadTerminalView,
}: CodeExplorerProps) => {
  const availableGuides = guides ?? [];
  const [selectedGuideId, setSelectedGuideId] = useState(
    availableGuides[0]?.id,
  );
  const selectedGuide = availableGuides.find(
    ({ id }) => id === selectedGuideId,
  );
  const isGuided = selectedGuide !== undefined;
  const [workspaceState, dispatch] = useReducer(
    reduceWorkspaceState,
    undefined,
    () =>
      createWorkspaceState(
        projectFiles,
        workspace.visibleFiles,
        selectedGuide?.path ?? workspace.initialFile,
      ),
  );
  const [typeFiles, setTypeFiles] = useState<ProjectFiles>({});
  const [terminalState, setTerminalState] =
    useState<TerminalPanelStateKind>("unstarted");
  const [syncError, setSyncError] = useState<string>();
  const terminalSession = useRef<TerminalSession>();
  const selectedPath = workspaceState.selectedPath;
  const isPreparing = terminalState === "preparing";
  const dirtyPaths = useMemo(
    () =>
      new Set(
        workspaceState.visiblePaths.filter(
          (path) => workspaceState.contents[path] !== projectFiles[path],
        ),
      ),
    [projectFiles, workspaceState.contents, workspaceState.visiblePaths],
  );

  const writeFile = useCallback((path: string, contents: string) => {
    const session = terminalSession.current;
    if (session === undefined) return;
    setSyncError(undefined);
    void session.writeFile(path, contents).catch((error: unknown) => {
      setSyncError(messageFrom(error));
    });
  }, []);

  const resetSelectedFile = () => {
    if (selectedPath === undefined) return;
    const original = projectFiles[selectedPath];
    if (original === undefined) return;
    dispatch({ kind: "reset", path: selectedPath, contents: original });
    writeFile(selectedPath, original);
  };

  const selectGuide = (guide: CodeGuide) => {
    setSelectedGuideId(guide.id);
    dispatch({ kind: "select", path: guide.path });
  };

  const handleWorkspaceChange = useCallback((change: WorkspaceChange) => {
    dispatch(
      change.kind === "write"
        ? {
            kind: "external-write",
            path: change.path,
            contents: change.contents,
          }
        : { kind: "external-delete", path: change.path },
    );
  }, []);

  const handleSessionChange = useCallback(
    (session: TerminalSession | undefined) => {
      terminalSession.current = session;
    },
    [],
  );

  const handleTerminalState = useCallback((state: TerminalPanelStateKind) => {
    setTerminalState(state);
  }, []);

  return (
    <section className="code-explorer">
      <p>{workspace.description}</p>
      <div className="code-explorer__workspace">
        {isGuided ? (
          <ol className="code-explorer__guides" aria-label="設計課題">
            {availableGuides.map((guide, index) => (
              <li key={guide.id}>
                <button
                  type="button"
                  data-code-guide={guide.id}
                  aria-pressed={guide.id === selectedGuideId}
                  onClick={() => selectGuide(guide)}
                >
                  <span aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{guide.title}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <FileTree
            paths={workspaceState.visiblePaths}
            selectedPath={selectedPath ?? ""}
            dirtyPaths={dirtyPaths}
            disabled={isPreparing}
            onSelect={(path) => dispatch({ kind: "select", path })}
          />
        )}
        <div className="code-explorer__editor">
          {isGuided ? (
            <div className="code-explorer__guide-detail" aria-live="polite">
              <p>
                <strong>現在の設計:</strong> {selectedGuide.currentDesign}
              </p>
              <p>
                <strong>将来困り得ること:</strong> {selectedGuide.futureRisk}
              </p>
            </div>
          ) : null}
          {selectedPath === undefined ? (
            <p className="code-explorer__empty">表示できるファイルがありません。</p>
          ) : (
            <Editor
              path={selectedPath}
              value={workspaceState.contents[selectedPath] ?? ""}
              files={workspaceState.contents}
              typeFiles={typeFiles}
              disabled={isPreparing}
              readOnly={isGuided}
              highlights={selectedGuide?.highlights ?? noHighlights}
              onChange={(value) => {
                if (isGuided) return;
                dispatch({
                  kind: "edit",
                  path: selectedPath,
                  contents: value,
                });
                writeFile(selectedPath, value);
              }}
            />
          )}
          {isGuided ? null : (
            <div className="code-explorer__actions">
              {syncError === undefined ? null : <p role="alert">{syncError}</p>}
              <button
                type="button"
                data-action="reset"
                disabled={
                  isPreparing || !canResetFile(projectFiles, selectedPath)
                }
                onClick={resetSelectedFile}
              >
                選択中のファイルをリセット
              </button>
            </div>
          )}
        </div>
      </div>
      {isGuided ? null : (
        <TerminalPanel
          files={workspaceState.contents}
          visibleFiles={workspaceState.visiblePaths}
          runnerFactory={runnerFactory}
          supportsRuntime={supportsRuntime}
          loadTerminalView={loadTerminalView}
          onTypeFiles={setTypeFiles}
          onWorkspaceChange={handleWorkspaceChange}
          onSessionChange={handleSessionChange}
          onStateChange={handleTerminalState}
        />
      )}
    </section>
  );
};
