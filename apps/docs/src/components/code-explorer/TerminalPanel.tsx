import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWebContainerTerminalRunner,
  type TerminalPhase,
  type TerminalRunner,
  type TerminalSession,
  type TerminalSize,
  type WorkspaceChange,
} from "../../code-explorer/runner";
import type { ProjectFiles } from "../../code-explorer/types";

export type TerminalView = Readonly<{
  open: (element: HTMLElement) => void;
  write: (data: string) => void;
  onData: (
    listener: (data: string) => void,
  ) => Readonly<{ dispose: () => void }>;
  fit: () => TerminalSize;
  focus: () => void;
  dispose: () => void;
}>;

export type TerminalPanelStateKind =
  | "unstarted"
  | "preparing"
  | "ready"
  | "exited"
  | "failed";

export type TerminalPanelProps = Readonly<{
  files: ProjectFiles;
  visibleFiles: readonly string[];
  runnerFactory?: () => TerminalRunner;
  supportsRuntime?: () => boolean;
  loadTerminalView?: () => Promise<TerminalView>;
  onTypeFiles: (files: ProjectFiles) => void;
  onWorkspaceChange: (change: WorkspaceChange) => void;
  onSessionChange: (session: TerminalSession | undefined) => void;
  onStateChange: (state: TerminalPanelStateKind) => void;
}>;

type PanelState =
  | Readonly<{ kind: "unstarted" }>
  | Readonly<{ kind: "preparing"; phase: TerminalPhase }>
  | Readonly<{ kind: "ready" }>
  | Readonly<{ kind: "exited"; exitCode: number; restarting: boolean }>
  | Readonly<{ kind: "failed"; message: string }>;

const initialTerminalSize: TerminalSize = { cols: 80, rows: 24 };

const phaseLabels: Readonly<Record<TerminalPhase, string>> = {
  booting: "実行環境を起動しています。",
  mounting: "教材ファイルを準備しています。",
  installing: "依存パッケージを準備しています。",
  "collecting-types": "エディタの型情報を準備しています。",
  "starting-shell": "シェルを起動しています。",
};

const messageFrom = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "ターミナルの起動中にエラーが発生しました。";

const defaultSupportsRuntime = (): boolean =>
  globalThis.crossOriginIsolated === true && typeof WebAssembly !== "undefined";

export const createXtermView = async (): Promise<TerminalView> => {
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
  ]);
  const terminal = new Terminal({
    convertEol: false,
    cursorBlink: true,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    screenReaderMode: true,
    theme: {
      background: "#101814",
      foreground: "#f4f1e8",
      cursor: "#fff49a",
      selectionBackground: "#3f6557",
    },
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  return {
    open: (element) => terminal.open(element),
    write: (data) => terminal.write(data),
    onData: (listener) => terminal.onData(listener),
    fit: () => {
      fitAddon.fit();
      return { cols: terminal.cols, rows: terminal.rows };
    },
    focus: () => terminal.focus(),
    dispose: () => terminal.dispose(),
  };
};

const defaultRunnerFactory = (): TerminalRunner =>
  createWebContainerTerminalRunner();

export const TerminalPanel = ({
  files,
  visibleFiles,
  runnerFactory = defaultRunnerFactory,
  supportsRuntime = defaultSupportsRuntime,
  loadTerminalView = createXtermView,
  onTypeFiles,
  onWorkspaceChange,
  onSessionChange,
  onStateChange,
}: TerminalPanelProps) => {
  const [state, setState] = useState<PanelState>({ kind: "unstarted" });
  const terminalHost = useRef<HTMLDivElement>(null);
  const terminalView = useRef<TerminalView>();
  const terminalSession = useRef<TerminalSession>();
  const terminalOpened = useRef(false);
  const inputSubscription = useRef<Readonly<{ dispose: () => void }>>();
  const resizeObserver = useRef<ResizeObserver>();
  const pendingOutput = useRef<string[]>([]);
  const pendingExitCode = useRef<number>();
  const mounted = useRef(true);
  const starting = useRef(false);

  const transition = useCallback(
    (nextState: PanelState) => {
      if (!mounted.current) return;
      setState(nextState);
      onStateChange(nextState.kind);
    },
    [onStateChange],
  );

  useEffect(() => {
    onStateChange("unstarted");
    return () => {
      mounted.current = false;
      inputSubscription.current?.dispose();
      resizeObserver.current?.disconnect();
      terminalView.current?.dispose();
      const session = terminalSession.current;
      terminalSession.current = undefined;
      onSessionChange(undefined);
      if (session !== undefined) void session.dispose();
    };
  }, [onSessionChange, onStateChange]);

  useEffect(() => {
    if (
      (state.kind !== "ready" && state.kind !== "exited") ||
      terminalOpened.current ||
      terminalHost.current === null ||
      terminalView.current === undefined ||
      terminalSession.current === undefined
    ) {
      return;
    }

    const view = terminalView.current;
    const session = terminalSession.current;
    view.open(terminalHost.current);
    terminalOpened.current = true;
    for (const chunk of pendingOutput.current.splice(0)) view.write(chunk);
    inputSubscription.current = view.onData((data) => {
      void session.writeInput(data).catch(() => undefined);
    });
    const fit = () => session.resize(view.fit());
    fit();
    resizeObserver.current = new ResizeObserver(fit);
    resizeObserver.current.observe(terminalHost.current);
    view.focus();
  }, [state.kind]);

  const startTerminal = useCallback(async () => {
    if (starting.current) return;
    if (!supportsRuntime()) {
      transition({
        kind: "failed",
        message:
          "ChromeまたはEdgeで開き、サイトの分離ヘッダーを確認してください。",
      });
      return;
    }

    starting.current = true;
    pendingOutput.current = [];
    pendingExitCode.current = undefined;
    transition({ kind: "preparing", phase: "booting" });

    let view: TerminalView | undefined;
    try {
      view = await loadTerminalView();
      if (!mounted.current) {
        view.dispose();
        return;
      }
      terminalView.current = view;
      const runner = runnerFactory();
      const session = await runner.start({
        files,
        visibleFiles,
        size: initialTerminalSize,
        onPhase: (phase) => transition({ kind: "preparing", phase }),
        onOutput: (chunk) => {
          if (terminalOpened.current) {
            terminalView.current?.write(chunk);
          } else {
            pendingOutput.current.push(chunk);
          }
        },
        onTypeFiles,
        onWorkspaceChange,
        onExit: (exitCode) => {
          if (terminalSession.current === undefined) {
            pendingExitCode.current = exitCode;
            return;
          }
          transition({ kind: "exited", exitCode, restarting: false });
        },
      });
      if (!mounted.current) {
        await session.dispose();
        view.dispose();
        return;
      }
      terminalSession.current = session;
      onSessionChange(session);
      const exitCode = pendingExitCode.current;
      pendingExitCode.current = undefined;
      transition(
        exitCode === undefined
          ? { kind: "ready" }
          : { kind: "exited", exitCode, restarting: false },
      );
    } catch (error: unknown) {
      view?.dispose();
      if (terminalView.current === view) terminalView.current = undefined;
      transition({ kind: "failed", message: messageFrom(error) });
    } finally {
      starting.current = false;
    }
  }, [
    files,
    loadTerminalView,
    onSessionChange,
    onTypeFiles,
    onWorkspaceChange,
    runnerFactory,
    supportsRuntime,
    transition,
    visibleFiles,
  ]);

  const restartTerminal = useCallback(async () => {
    const session = terminalSession.current;
    const view = terminalView.current;
    if (session === undefined || view === undefined || state.kind !== "exited") {
      return;
    }
    transition({ ...state, restarting: true });
    try {
      await session.restartShell(view.fit());
      transition({ kind: "ready" });
      view.focus();
    } catch (error: unknown) {
      await session.dispose();
      terminalSession.current = undefined;
      onSessionChange(undefined);
      inputSubscription.current?.dispose();
      resizeObserver.current?.disconnect();
      view.dispose();
      terminalView.current = undefined;
      terminalOpened.current = false;
      transition({ kind: "failed", message: messageFrom(error) });
    }
  }, [onSessionChange, state, transition]);

  const showsTerminal = state.kind === "ready" || state.kind === "exited";

  return (
    <section className="code-explorer__terminal" data-state={state.kind}>
      {state.kind === "unstarted" ? (
        <div className="code-explorer__terminal-prompt">
          <p>
            コマンドはブラウザ内の隔離環境で実行され、ローカルPCのファイルにはアクセスしません。
          </p>
          <button
            type="button"
            data-action="start-terminal"
            onClick={() => void startTerminal()}
          >
            ターミナルを起動
          </button>
        </div>
      ) : null}
      {state.kind === "preparing" ? (
        <p className="code-explorer__terminal-status" role="status" aria-live="polite">
          {phaseLabels[state.phase]}
        </p>
      ) : null}
      {state.kind === "failed" ? (
        <div className="code-explorer__terminal-status">
          <p role="alert">{state.message}</p>
          <button
            type="button"
            data-action="retry-terminal"
            onClick={() => void startTerminal()}
          >
            ターミナルを再試行
          </button>
        </div>
      ) : null}
      {showsTerminal ? (
        <div className="code-explorer__terminal-shell">
          <div
            ref={terminalHost}
            className="code-explorer__terminal-screen"
            aria-label="コード実行ターミナル"
          />
          {state.kind === "exited" ? (
            <div className="code-explorer__terminal-exit" aria-live="polite">
              <p>シェルが終了しました（終了コード {state.exitCode}）。</p>
              <button
                type="button"
                data-action="restart-terminal"
                disabled={state.restarting}
                onClick={() => void restartTerminal()}
              >
                {state.restarting ? "再起動しています" : "ターミナルを再起動"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
