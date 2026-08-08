import { useMemo, useRef, useState, type ComponentType } from "react";
import {
  createWebContainerRunner,
  type CodeRunner,
  type RunnerPhase,
  type RunnerUpdate,
} from "../../code-explorer/runner";
import { runModeFor, type RunMode } from "../../code-explorer/run-command";
import type { CodeGuide, CodeHighlight } from "../../code-explorer/code-guide";
import type { ProjectFiles, SessionWorkspace } from "../../code-explorer/types";
import { FileTree } from "./FileTree";
import { MonacoEditor } from "./MonacoEditor";
import { OutputPanel, type ExecutionState } from "./OutputPanel";

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
  runnerFactory?: () => CodeRunner;
  supportsRuntime?: () => boolean;
}>;

const defaultSupportsRuntime = (): boolean =>
  globalThis.crossOriginIsolated === true && typeof WebAssembly !== "undefined";

const defaultRunnerFactory = (): CodeRunner => createWebContainerRunner();

const noHighlights: readonly CodeHighlight[] = [];

const phaseLabels: Readonly<Record<RunnerPhase, string>> = {
  booting: "実行環境を起動しています。",
  mounting: "教材ファイルを準備しています。",
  installing: "依存パッケージを準備しています。",
  running: "コードを実行しています。",
};

const outputFrom = (state: ExecutionState): string =>
  state.kind === "idle" ? "" : state.output;

const messageFrom = (error: unknown): string =>
  error instanceof Error ? error.message : "実行中にエラーが発生しました。";

export const CodeExplorer = ({
  workspace,
  projectFiles,
  guides,
  Editor = MonacoEditor,
  runnerFactory = defaultRunnerFactory,
  supportsRuntime = defaultSupportsRuntime,
}: CodeExplorerProps) => {
  const availableGuides = guides ?? [];
  const [selectedGuideId, setSelectedGuideId] = useState(
    availableGuides[0]?.id,
  );
  const selectedGuide = availableGuides.find(
    ({ id }) => id === selectedGuideId,
  );
  const isGuided = selectedGuide !== undefined;
  const [selectedPath, setSelectedPath] = useState(
    selectedGuide?.path ?? workspace.initialFile,
  );
  const [contents, setContents] = useState<ProjectFiles>(() => ({
    ...projectFiles,
  }));
  const [typeFiles, setTypeFiles] = useState<ProjectFiles>({});
  const [execution, setExecution] = useState<ExecutionState>({ kind: "idle" });
  const [isRunning, setIsRunning] = useState(false);
  const runner = useRef<CodeRunner>();
  const activeRun = useRef<AbortController>();
  const dirtyPaths = useMemo(
    () =>
      new Set(
        workspace.visibleFiles.filter(
          (path) => contents[path] !== projectFiles[path],
        ),
      ),
    [contents, projectFiles, workspace.visibleFiles],
  );

  const updateExecution = (
    update: RunnerUpdate,
    provenance: Readonly<{ filePath: string; mode: RunMode | undefined }>,
  ) => {
    if (update.kind === "type-files") {
      setTypeFiles(update.files);
      return;
    }

    setExecution((current) => {
      const output = outputFrom(current);
      if (update.kind === "phase") {
        return {
          kind: "working",
          label: phaseLabels[update.phase],
          output,
          ...provenance,
        };
      }
      return {
        kind: "working",
        label: current.kind === "working" ? current.label : phaseLabels.running,
        output: `${output}${update.chunk}`,
        ...provenance,
      };
    });
  };

  const run = async () => {
    if (isRunning) return;
    const provenance = {
      filePath: selectedPath,
      mode: runModeFor(selectedPath),
    };
    if (!supportsRuntime()) {
      setExecution({
        kind: "error",
        output: "",
        message:
          "ChromeまたはEdgeで開き、サイトの分離ヘッダーを確認してください。",
        ...provenance,
      });
      return;
    }

    setIsRunning(true);
    const controller = new AbortController();
    activeRun.current = controller;
    setExecution({
      kind: "working",
      label: "実行を準備しています。",
      output: "",
      ...provenance,
    });

    try {
      runner.current ??= runnerFactory();
      const result = await runner.current.run(
        {
          filePath: provenance.filePath,
          files: contents,
          signal: controller.signal,
        },
        (update) => updateExecution(update, provenance),
      );
      setExecution((current) => ({
        kind: "finished",
        output: outputFrom(current),
        exitCode: result.exitCode,
        ...provenance,
      }));
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        setExecution((current) => ({
          kind: "canceled",
          output: outputFrom(current),
          message: "実行を停止しました。",
          ...provenance,
        }));
        return;
      }
      setExecution((current) => ({
        kind: "error",
        output: outputFrom(current),
        message: messageFrom(error),
        ...provenance,
      }));
    } finally {
      if (activeRun.current === controller) activeRun.current = undefined;
      setIsRunning(false);
    }
  };

  const stop = () => activeRun.current?.abort();

  const resetSelectedFile = () => {
    setContents((current) => ({
      ...current,
      [selectedPath]: projectFiles[selectedPath] ?? "",
    }));
  };

  const selectGuide = (guide: CodeGuide) => {
    setSelectedGuideId(guide.id);
    setSelectedPath(guide.path);
  };

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
            paths={workspace.visibleFiles}
            selectedPath={selectedPath}
            dirtyPaths={dirtyPaths}
            disabled={isRunning}
            onSelect={setSelectedPath}
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
          <Editor
            path={selectedPath}
            value={contents[selectedPath] ?? ""}
            files={contents}
            typeFiles={typeFiles}
            disabled={isRunning}
            readOnly={isGuided}
            highlights={selectedGuide?.highlights ?? noHighlights}
            onChange={(value) => {
              if (isGuided) return;
              setContents((current) => ({ ...current, [selectedPath]: value }));
            }}
          />
          {isGuided ? null : (
            <div className="code-explorer__actions">
              <button
                type="button"
                data-action="reset"
                disabled={isRunning}
                onClick={resetSelectedFile}
              >
                選択中のファイルをリセット
              </button>
              <button
                type="button"
                data-action="run"
                disabled={isRunning}
                onClick={run}
              >
                実行
              </button>
              {isRunning ? (
                <button
                  type="button"
                  data-action="stop"
                  aria-label="実行を停止"
                  onClick={stop}
                >
                  停止
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {isGuided ? null : <OutputPanel state={execution} />}
    </section>
  );
};
