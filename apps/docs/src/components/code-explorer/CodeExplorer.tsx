import { useMemo, useRef, useState, type ComponentType } from "react";
import {
  createWebContainerRunner,
  type CodeRunner,
  type RunnerPhase,
  type RunnerUpdate,
} from "../../code-explorer/runner";
import type { ModuleWorkspace, ProjectFiles } from "../../code-explorer/types";
import { FileTree } from "./FileTree";
import { MonacoEditor } from "./MonacoEditor";
import { OutputPanel, type ExecutionState } from "./OutputPanel";

export type EditorProps = Readonly<{
  path: string;
  value: string;
  files: ProjectFiles;
  typeFiles: ProjectFiles;
  disabled: boolean;
  onChange: (value: string) => void;
}>;

export type CodeExplorerProps = Readonly<{
  workspace: ModuleWorkspace;
  projectFiles: ProjectFiles;
  Editor?: ComponentType<EditorProps>;
  runnerFactory?: () => CodeRunner;
  supportsRuntime?: () => boolean;
}>;

const defaultSupportsRuntime = (): boolean =>
  globalThis.crossOriginIsolated === true && typeof WebAssembly !== "undefined";

const defaultRunnerFactory = (): CodeRunner => createWebContainerRunner();

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
  Editor = MonacoEditor,
  runnerFactory = defaultRunnerFactory,
  supportsRuntime = defaultSupportsRuntime,
}: CodeExplorerProps) => {
  const [selectedPath, setSelectedPath] = useState(workspace.initialFile);
  const [contents, setContents] = useState<ProjectFiles>(() => ({
    ...projectFiles,
  }));
  const [typeFiles, setTypeFiles] = useState<ProjectFiles>({});
  const [execution, setExecution] = useState<ExecutionState>({ kind: "idle" });
  const [isRunning, setIsRunning] = useState(false);
  const runner = useRef<CodeRunner>();
  const dirtyPaths = useMemo(
    () =>
      new Set(
        workspace.visibleFiles.filter(
          (path) => contents[path] !== projectFiles[path],
        ),
      ),
    [contents, projectFiles, workspace.visibleFiles],
  );

  const updateExecution = (update: RunnerUpdate) => {
    if (update.kind === "type-files") {
      setTypeFiles(update.files);
      return;
    }

    setExecution((current) => {
      const output = outputFrom(current);
      if (update.kind === "phase") {
        return { kind: "working", label: phaseLabels[update.phase], output };
      }
      return {
        kind: "working",
        label: current.kind === "working" ? current.label : phaseLabels.running,
        output: `${output}${update.chunk}`,
      };
    });
  };

  const run = async () => {
    if (isRunning) return;
    if (!supportsRuntime()) {
      setExecution({
        kind: "error",
        output: "",
        message:
          "ChromeまたはEdgeで開き、サイトの分離ヘッダーを確認してください。",
      });
      return;
    }

    setIsRunning(true);
    setExecution({
      kind: "working",
      label: "実行を準備しています。",
      output: "",
    });

    try {
      runner.current ??= runnerFactory();
      const result = await runner.current.run(
        { filePath: selectedPath, files: contents },
        updateExecution,
      );
      setExecution((current) => ({
        kind: "finished",
        output: outputFrom(current),
        exitCode: result.exitCode,
      }));
    } catch (error: unknown) {
      setExecution((current) => ({
        kind: "error",
        output: outputFrom(current),
        message: messageFrom(error),
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const resetSelectedFile = () => {
    setContents((current) => ({
      ...current,
      [selectedPath]: projectFiles[selectedPath] ?? "",
    }));
  };

  return (
    <section className="code-explorer">
      <p>{workspace.description}</p>
      <div className="code-explorer__workspace">
        <FileTree
          paths={workspace.visibleFiles}
          selectedPath={selectedPath}
          dirtyPaths={dirtyPaths}
          disabled={isRunning}
          onSelect={setSelectedPath}
        />
        <div className="code-explorer__editor">
          <Editor
            path={selectedPath}
            value={contents[selectedPath] ?? ""}
            files={contents}
            typeFiles={typeFiles}
            disabled={isRunning}
            onChange={(value) =>
              setContents((current) => ({ ...current, [selectedPath]: value }))
            }
          />
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
          </div>
        </div>
      </div>
      <OutputPanel state={execution} />
    </section>
  );
};
