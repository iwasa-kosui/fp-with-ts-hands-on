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
  createIndexedDbWorkspaceStore,
  type WorkspaceStore,
} from "../../code-explorer/workspace-store";
import { computeEdits } from "../../code-explorer/workspace-persistence";
import { TerminalPanel, type TerminalView } from "./TerminalPanel";
import { useWorkspacePersistence } from "./useWorkspacePersistence";
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
  initialCommand?: string;
  guides?: readonly CodeGuide[];
  Editor?: ComponentType<EditorProps>;
  runnerFactory?: () => TerminalRunner;
  supportsRuntime?: () => boolean;
  loadTerminalView?: () => Promise<TerminalView>;
  workspaceStore?: WorkspaceStore;
}>;

const noHighlights: readonly CodeHighlight[] = [];

const messageFrom = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "ファイルを実行環境へ反映できませんでした。";

export const CodeExplorer = ({
  workspace,
  projectFiles,
  initialCommand,
  guides,
  Editor = MonacoEditor,
  runnerFactory,
  supportsRuntime,
  loadTerminalView,
  workspaceStore,
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
  const [store] = useState(
    () => workspaceStore ?? createIndexedDbWorkspaceStore(),
  );
  const [syncError, setSyncError] = useState<string>();
  const terminalSession = useRef<TerminalSession>();
  const pendingFileWrites = useRef<Promise<void>>(Promise.resolve());
  const contentsRef = useRef(workspaceState.contents);
  contentsRef.current = workspaceState.contents;
  const selectedPath = workspaceState.selectedPath;
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
    const nextWrite = pendingFileWrites.current
      .catch(() => undefined)
      .then(() => session.writeFile(path, contents));
    pendingFileWrites.current = nextWrite;
    void nextWrite.catch((error: unknown) => {
      if (terminalSession.current !== session) return;
      setSyncError(messageFrom(error));
    });
  }, []);

  const waitForPendingFileWrites = useCallback(
    () => pendingFileWrites.current,
    [],
  );

  const syncFiles = useCallback(
    async (mountedFiles: ProjectFiles) => {
      for (const [path, contents] of Object.entries(contentsRef.current)) {
        if (mountedFiles[path] !== contents) writeFile(path, contents);
      }
      await pendingFileWrites.current;
    },
    [writeFile],
  );

  const persistence = useWorkspacePersistence({
    slug: workspace.slug,
    projectFiles,
    visiblePaths: workspace.visibleFiles,
    contents: workspaceState.contents,
    selectedPath,
    dispatch,
    store,
    enabled: !isGuided,
    writeToSession: writeFile,
  });
  const { status, notice } = persistence;
  const hasEdits = useMemo(
    () =>
      Object.keys(computeEdits(workspaceState.contents, projectFiles)).length >
      0,
    [projectFiles, workspaceState.contents],
  );
  const isLocked = status.kind === "loading" || status.kind === "outdated";

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
            disabled={isLocked}
            onSelect={(path) => dispatch({ kind: "select", path })}
          />
        )}
        <div className="code-explorer__editor">
          {isGuided ? null : (
            <>
              {notice === "restored" ? (
                <div
                  className="code-explorer__notice"
                  role="status"
                  aria-live="polite"
                >
                  <p>前回の編集を読み込みました。</p>
                </div>
              ) : null}
              {notice === "lost" && status.kind !== "read-failed" ? (
                <div className="code-explorer__notice" role="alert">
                  <p>
                    前の編集を読み出せませんでした。開始の状態で表示しています。
                  </p>
                </div>
              ) : null}
              {status.kind === "read-failed" ? (
                <div className="code-explorer__notice" role="alert">
                  <p>
                    前の編集を読み出せませんでした。開始の状態で表示しています。このページの編集は保存されません。ページを再読み込みすると、もう一度読み出します。そのとき、このページで書いた編集は消えます。
                  </p>
                </div>
              ) : null}
              {status.kind === "save-failed" ? (
                <div className="code-explorer__notice" role="alert">
                  <p>
                    編集を保存できませんでした。このページを閉じると、保存していない編集は失われます。
                  </p>
                  <button
                    type="button"
                    data-action="retry-save"
                    onClick={() => void persistence.retrySave()}
                  >
                    もう一度保存する
                  </button>
                </div>
              ) : null}
              {status.kind === "outdated" ? (
                <div className="code-explorer__notice" role="alert">
                  <p>教材が更新されました。前の編集を使いますか。</p>
                  <p>対象のファイル: {status.paths.join("、")}</p>
                  <p>
                    更新後のコードで始めると、対象のファイルの前の編集は消え、元に戻せません。
                  </p>
                  <button
                    type="button"
                    data-action="use-saved-edits"
                    onClick={persistence.chooseSavedEdits}
                  >
                    前の編集を使う
                  </button>
                  <button
                    type="button"
                    data-action="use-updated-code"
                    onClick={persistence.chooseUpdatedCode}
                  >
                    更新後のコードで始める
                  </button>
                </div>
              ) : null}
              {status.kind === "conflict" ? (
                <div className="code-explorer__notice" role="alert">
                  <p>
                    別のタブでこの Session の編集が保存されました。このタブの編集はまだ保存していません。どちらを残すか選んでください。
                  </p>
                  <button
                    type="button"
                    data-action="load-other-tab"
                    onClick={() => void persistence.loadOtherTab()}
                  >
                    別のタブの編集を読み込む
                  </button>
                  <button
                    type="button"
                    data-action="overwrite-other-tab"
                    onClick={() => void persistence.overwriteOtherTab()}
                  >
                    このタブの編集で上書きする
                  </button>
                </div>
              ) : null}
            </>
          )}
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
              disabled={isLocked}
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
                disabled={isLocked || !canResetFile(projectFiles, selectedPath)}
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
          initialCommand={initialCommand}
          runnerFactory={runnerFactory}
          supportsRuntime={supportsRuntime}
          loadTerminalView={loadTerminalView}
          onTypeFiles={setTypeFiles}
          onWorkspaceChange={handleWorkspaceChange}
          onSessionChange={handleSessionChange}
          waitForPendingFileWrites={waitForPendingFileWrites}
          syncFiles={syncFiles}
          restoredOutput={persistence.restoredOutput}
          outputStale={persistence.outputStale}
          onOutput={persistence.appendTerminalOutput}
          startDisabled={isLocked}
          hasEdits={hasEdits}
          onCommandSent={persistence.notifyCommandSent}
        />
      )}
    </section>
  );
};
