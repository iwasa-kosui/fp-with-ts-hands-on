import { useCallback, useEffect, useRef, useState } from "react";
import {
  prefetchDepsSnapshot,
  type DepsSnapshotProgress,
} from "../../code-explorer/deps-snapshot";
import {
  createWebContainerTerminalRunner,
  TerminalInstallError,
  TerminalPreparationTimeoutError,
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
  initialCommand?: string;
  runnerFactory?: () => TerminalRunner;
  supportsRuntime?: () => boolean;
  prefetchDeps?: () => Promise<void>;
  loadTerminalView?: () => Promise<TerminalView>;
  onTypeFiles: (files: ProjectFiles) => void;
  onWorkspaceChange: (change: WorkspaceChange) => void;
  onSessionChange: (session: TerminalSession | undefined) => void;
  onStateChange: (state: TerminalPanelStateKind) => void;
  waitForPendingFileWrites?: () => Promise<void>;
}>;

type PanelState =
  | Readonly<{ kind: "unstarted" }>
  | Readonly<{ kind: "preparing"; phase: TerminalPhase; startedAt: number }>
  | Readonly<{ kind: "ready" }>
  | Readonly<{ kind: "exited"; exitCode: number; restarting: boolean }>
  | Readonly<{ kind: "failed"; message: string; suggestsSetup: boolean }>;

type DownloadProgress = DepsSnapshotProgress & Readonly<{ firstAt: number }>;

const initialTerminalSize: TerminalSize = { cols: 80, rows: 24 };

const phaseLabels: Readonly<Record<TerminalPhase, string>> = {
  booting: "実行環境を起動しています。",
  mounting: "教材ファイルを準備しています。",
  "downloading-deps": "依存パッケージを取得しています。",
  "restoring-deps": "依存パッケージを展開しています。",
  installing: "依存パッケージをインストールしています。1〜2分かかることがあります。",
  "collecting-types": "エディタの型情報を準備しています。",
  "starting-shell": "シェルを起動しています。",
};

const retryGuidance =
  "ネットワークの接続を確かめてから「ターミナルを再試行」を押してください。";

const failureFrom = (
  error: unknown,
): Readonly<{ message: string; suggestsSetup: boolean }> => {
  if (error instanceof TerminalPreparationTimeoutError) {
    return {
      message: `準備が時間内に終わりませんでした。${retryGuidance}`,
      suggestsSetup: true,
    };
  }
  if (error instanceof TerminalInstallError) {
    return {
      message: `依存パッケージの取得に失敗しました。${retryGuidance}`,
      suggestsSetup: true,
    };
  }
  return {
    message: "ターミナルの起動中にエラーが発生しました。",
    suggestsSetup: false,
  };
};

const bytesPerMegabyte = 1024 * 1024;

const remainingLabel = (
  progress: DownloadProgress,
  now: number,
): string | undefined => {
  const elapsedMilliseconds = now - progress.firstAt;
  if (
    elapsedMilliseconds < 1000 ||
    progress.loaded <= 0 ||
    progress.loaded >= progress.total
  ) {
    return undefined;
  }
  const bytesPerSecond = progress.loaded / (elapsedMilliseconds / 1000);
  const remaining = (progress.total - progress.loaded) / bytesPerSecond;
  const seconds =
    remaining > 10
      ? Math.round(remaining / 10) * 10
      : Math.max(1, Math.ceil(remaining));
  return `残り約${seconds}秒`;
};

const PreparationDetail = ({
  phase,
  startedAt,
  readProgress,
}: Readonly<{
  phase: TerminalPhase;
  startedAt: number;
  readProgress: () => DownloadProgress | undefined;
}>) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const progress = phase === "downloading-deps" ? readProgress() : undefined;
  const remaining =
    progress === undefined ? undefined : remainingLabel(progress, now);

  return (
    <div className="code-explorer__terminal-progress" aria-hidden="true">
      <p>経過 {Math.max(0, Math.floor((now - startedAt) / 1000))}秒</p>
      {progress === undefined ? null : (
        <p>
          <progress value={progress.loaded} max={progress.total} />
          <span>
            {Math.round(progress.loaded / bytesPerMegabyte)} /{" "}
            {Math.round(progress.total / bytesPerMegabyte)} MB
            {remaining === undefined ? "" : `、${remaining}`}
          </span>
        </p>
      )}
    </div>
  );
};

type NetworkInformationNavigator = Navigator &
  Readonly<{ connection?: Readonly<{ saveData?: boolean }> }>;

const defaultSupportsRuntime = (): boolean =>
  globalThis.crossOriginIsolated === true && typeof WebAssembly !== "undefined";

const noPendingFileWrites = async (): Promise<void> => undefined;

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
  initialCommand,
  runnerFactory = defaultRunnerFactory,
  supportsRuntime = defaultSupportsRuntime,
  prefetchDeps = prefetchDepsSnapshot,
  loadTerminalView = createXtermView,
  onTypeFiles,
  onWorkspaceChange,
  onSessionChange,
  onStateChange,
  waitForPendingFileWrites = noPendingFileWrites,
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
  const startupAbort = useRef<AbortController>();
  const attemptGeneration = useRef(0);
  const preparationStartedAt = useRef(0);
  const downloadProgress = useRef<DownloadProgress>();
  const onTypeFilesRef = useRef(onTypeFiles);
  const onWorkspaceChangeRef = useRef(onWorkspaceChange);
  const onSessionChangeRef = useRef(onSessionChange);
  const onStateChangeRef = useRef(onStateChange);
  const waitForPendingFileWritesRef = useRef(waitForPendingFileWrites);

  onTypeFilesRef.current = onTypeFiles;
  onWorkspaceChangeRef.current = onWorkspaceChange;
  onSessionChangeRef.current = onSessionChange;
  onStateChangeRef.current = onStateChange;
  waitForPendingFileWritesRef.current = waitForPendingFileWrites;

  const transition = useCallback((nextState: PanelState) => {
    if (!mounted.current) return;
    setState(nextState);
    onStateChangeRef.current(nextState.kind);
  }, []);

  useEffect(() => {
    mounted.current = true;
    onStateChangeRef.current("unstarted");
    return () => {
      mounted.current = false;
      attemptGeneration.current += 1;
      startupAbort.current?.abort();
      startupAbort.current = undefined;
      inputSubscription.current?.dispose();
      resizeObserver.current?.disconnect();
      const view = terminalView.current;
      terminalView.current = undefined;
      view?.dispose();
      const session = terminalSession.current;
      terminalSession.current = undefined;
      onSessionChangeRef.current(undefined);
      if (session !== undefined) void session.dispose();
    };
  }, []);

  useEffect(() => {
    if (
      !supportsRuntime() ||
      (navigator as NetworkInformationNavigator).connection?.saveData === true
    ) {
      return;
    }
    const prefetch = () => void prefetchDeps().catch(() => undefined);
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(prefetch);
      return () => cancelIdleCallback(handle);
    }
    const timer = setTimeout(prefetch, 2000);
    return () => clearTimeout(timer);
  }, []);

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
      void waitForPendingFileWritesRef
        .current()
        .then(() => session.writeInput(data))
        .catch(() => undefined);
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
        suggestsSetup: false,
      });
      return;
    }

    starting.current = true;
    const controller = new AbortController();
    startupAbort.current = controller;
    const attempt = ++attemptGeneration.current;
    const isActiveAttempt = () =>
      mounted.current &&
      attemptGeneration.current === attempt &&
      !controller.signal.aborted;
    pendingOutput.current = [];
    pendingExitCode.current = undefined;
    downloadProgress.current = undefined;
    preparationStartedAt.current = Date.now();
    transition({
      kind: "preparing",
      phase: "booting",
      startedAt: preparationStartedAt.current,
    });

    let view: TerminalView | undefined;
    let session: TerminalSession | undefined;
    try {
      view = await loadTerminalView();
      if (!isActiveAttempt()) {
        view.dispose();
        return;
      }
      terminalView.current = view;
      const runner = runnerFactory();
      session = await runner.start({
        files,
        visibleFiles,
        size: initialTerminalSize,
        signal: controller.signal,
        onPhase: (phase) => {
          if (isActiveAttempt()) {
            transition({
              kind: "preparing",
              phase,
              startedAt: preparationStartedAt.current,
            });
          }
        },
        onDownloadProgress: (progress) => {
          if (!isActiveAttempt()) return;
          downloadProgress.current = {
            ...progress,
            firstAt: downloadProgress.current?.firstAt ?? Date.now(),
          };
        },
        onOutput: (chunk) => {
          if (!isActiveAttempt()) return;
          if (terminalOpened.current) {
            terminalView.current?.write(chunk);
          } else {
            pendingOutput.current.push(chunk);
          }
        },
        onTypeFiles: (nextFiles) => {
          if (isActiveAttempt()) onTypeFilesRef.current(nextFiles);
        },
        onWorkspaceChange: (change) => {
          if (isActiveAttempt()) onWorkspaceChangeRef.current(change);
        },
        onExit: (exitCode) => {
          if (!isActiveAttempt()) return;
          if (terminalSession.current === undefined) {
            pendingExitCode.current = exitCode;
            return;
          }
          transition({ kind: "exited", exitCode, restarting: false });
        },
      });
      if (!isActiveAttempt()) {
        await session.dispose();
        if (terminalView.current === view) terminalView.current = undefined;
        view.dispose();
        return;
      }
      if (initialCommand !== undefined) {
        await session.writeInput(`${initialCommand}\r`);
        if (!isActiveAttempt()) {
          await session.dispose();
          return;
        }
      }
      terminalSession.current = session;
      onSessionChangeRef.current(session);
      session = undefined;
      const exitCode = pendingExitCode.current;
      pendingExitCode.current = undefined;
      transition(
        exitCode === undefined
          ? { kind: "ready" }
          : { kind: "exited", exitCode, restarting: false },
      );
    } catch (error: unknown) {
      await session?.dispose();
      if (view !== undefined && terminalView.current === view) {
        terminalView.current = undefined;
        view.dispose();
      }
      if (isActiveAttempt()) {
        transition({ kind: "failed", ...failureFrom(error) });
      }
    } finally {
      if (attemptGeneration.current === attempt) {
        starting.current = false;
        startupAbort.current = undefined;
      }
    }
  }, [
    files,
    initialCommand,
    loadTerminalView,
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
      onSessionChangeRef.current(undefined);
      inputSubscription.current?.dispose();
      resizeObserver.current?.disconnect();
      view.dispose();
      terminalView.current = undefined;
      terminalOpened.current = false;
      transition({ kind: "failed", ...failureFrom(error) });
    }
  }, [state, transition]);

  const cancelPreparation = useCallback(() => {
    attemptGeneration.current += 1;
    startupAbort.current?.abort();
    startupAbort.current = undefined;
    starting.current = false;
    transition({ kind: "unstarted" });
  }, [transition]);

  const showsTerminal = state.kind === "ready" || state.kind === "exited";

  return (
    <section className="code-explorer__terminal" data-state={state.kind}>
      {state.kind === "unstarted" ? (
        <div className="code-explorer__terminal-prompt">
          {initialCommand === undefined ? (
            <p>
              コマンドはブラウザ内の隔離環境で実行され、ローカルPCのファイルにはアクセスしません。
            </p>
          ) : null}
          <button
            type="button"
            data-action="start-terminal"
            onClick={() => void startTerminal()}
          >
            {initialCommand === undefined
              ? "ターミナルを起動"
              : "修正前の失敗を確認"}
          </button>
        </div>
      ) : null}
      {state.kind === "preparing" ? (
        <div className="code-explorer__terminal-status">
          <p role="status" aria-live="polite">
            {phaseLabels[state.phase]}
          </p>
          <PreparationDetail
            phase={state.phase}
            startedAt={state.startedAt}
            readProgress={() => downloadProgress.current}
          />
          <button
            type="button"
            data-action="cancel-terminal"
            onClick={cancelPreparation}
          >
            準備をやめる
          </button>
        </div>
      ) : null}
      {state.kind === "failed" ? (
        <div className="code-explorer__terminal-status">
          <p role="alert">{state.message}</p>
          {state.suggestsSetup ? (
            <p>
              繰り返し失敗するときは、<a href="/setup/">環境構築のページ</a>
              の手順で手元で進めてください。
            </p>
          ) : null}
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
          <div className="code-explorer__terminal-viewport">
            <div
              ref={terminalHost}
              className="code-explorer__terminal-screen"
              role="region"
              aria-label="コード実行ターミナル"
            />
          </div>
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
