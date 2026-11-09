import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
import { startMeasure } from "../../code-explorer/measure";
import type { ProjectFiles } from "../../code-explorer/types";

export type TerminalView = Readonly<{
  open: (element: HTMLElement) => void;
  write: (data: string, onWritten?: () => void) => void;
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

export type TerminalPanelController = Readonly<{
  ensureSession: () => Promise<TerminalSession>;
  releaseSession: () => Promise<void>;
}>;

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
  onStateChange?: (state: TerminalPanelStateKind) => void;
  onPhaseChange?: (phase: TerminalPhase | undefined) => void;
  waitForPendingFileWrites?: () => Promise<void>;
  syncFiles?: (mountedFiles: ProjectFiles) => Promise<void>;
  restoredOutput?: string;
  outputStale: boolean;
  onOutput?: (chunk: string) => void;
  startDisabled: boolean;
  hasEdits: boolean;
  onCommandSent?: () => void;
}>;

type PanelState =
  | Readonly<{ kind: "unstarted" }>
  | Readonly<{ kind: "preparing"; phase: TerminalPhase; startedAt: number }>
  | Readonly<{ kind: "ready" }>
  | Readonly<{ kind: "exited"; exitCode: number; restarting: boolean }>
  | Readonly<{ kind: "failed"; message: string; suggestsSetup: boolean }>;

type DownloadProgress = DepsSnapshotProgress &
  Readonly<{ firstAt: number; firstLoaded: number }>;

const initialTerminalSize: TerminalSize = { cols: 80, rows: 24 };

export const phaseLabels: Readonly<Record<TerminalPhase, string>> = {
  booting: "実行環境を起動しています。",
  mounting: "教材ファイルを準備しています。",
  "downloading-deps": "依存パッケージを取得しています。",
  "restoring-deps": "依存パッケージを展開しています。",
  installing: "依存パッケージをインストールしています。1〜2分かかることがあります。",
  "collecting-types": "エディタの型情報を準備しています。",
  "starting-shell": "シェルを起動しています。",
};

const retryGuidance = "「ターミナルを再試行」を押してください。";
const networkRetryGuidance = `ネットワークの接続を確かめてから${retryGuidance}`;

const timeoutMessageFor = (phase: TerminalPhase): string => {
  if (phase === "booting") {
    return `実行環境の起動が時間内に終わりませんでした。${networkRetryGuidance}`;
  }
  if (phase === "installing") {
    return `依存パッケージのインストールが時間内に終わりませんでした。${networkRetryGuidance}`;
  }
  return `準備が時間内に終わりませんでした。${retryGuidance}`;
};

const failureFrom = (
  error: unknown,
): Readonly<{ message: string; suggestsSetup: boolean }> => {
  if (error instanceof TerminalPreparationTimeoutError) {
    return { message: timeoutMessageFor(error.phase), suggestsSetup: true };
  }
  if (error instanceof TerminalInstallError) {
    return {
      message: `依存パッケージの取得に失敗しました。${networkRetryGuidance}`,
      suggestsSetup: true,
    };
  }
  return {
    message: `ターミナルの起動中にエラーが発生しました。${retryGuidance}`,
    suggestsSetup: true,
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
    progress.loaded <= progress.firstLoaded ||
    progress.loaded >= progress.total
  ) {
    return undefined;
  }
  const bytesPerSecond =
    (progress.loaded - progress.firstLoaded) / (elapsedMilliseconds / 1000);
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

const previousOutputDelimiter =
  "\r\n\x1b[!p\x1b[2m--- ここまでが前回の出力です ---\x1b[0m\r\n";

const disposedViews = new WeakSet<TerminalView>();

const disposeView = (view: TerminalView): void => {
  if (disposedViews.has(view)) return;
  disposedViews.add(view);
  view.dispose();
};

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
    write: (data, onWritten) => terminal.write(data, onWritten),
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

export const TerminalPanel = forwardRef<
  TerminalPanelController,
  TerminalPanelProps
>(({
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
  onPhaseChange,
  waitForPendingFileWrites = noPendingFileWrites,
  syncFiles,
  restoredOutput,
  outputStale,
  onOutput,
  startDisabled,
  hasEdits,
  onCommandSent,
}, ref) => {
  const [state, setState] = useState<PanelState>({ kind: "unstarted" });
  const terminalHost = useRef<HTMLDivElement>(null);
  const terminalView = useRef<TerminalView>();
  const terminalSession = useRef<TerminalSession>();
  const viewOpened = useRef(false);
  const inputSubscribed = useRef(false);
  const viewPromise = useRef<Promise<TerminalView>>();
  const restoreStarted = useRef(false);
  const restoredViewOpened = useRef(false);
  const delimiterWritten = useRef(false);
  const inputSubscription = useRef<Readonly<{ dispose: () => void }>>();
  const resizeObserver = useRef<ResizeObserver>();
  const pendingOutput = useRef<string[]>([]);
  const pendingExitCode = useRef<number>();
  const mounted = useRef(true);
  const starting = useRef(false);
  const startupAbort = useRef<AbortController>();
  const attemptGeneration = useRef(0);
  const startPromise = useRef<Promise<void>>();
  const lastFailure = useRef<string>();
  const preparationStartedAt = useRef(0);
  const downloadProgress = useRef<DownloadProgress>();
  const skipDepsSnapshot = useRef(false);
  const onTypeFilesRef = useRef(onTypeFiles);
  const onWorkspaceChangeRef = useRef(onWorkspaceChange);
  const onSessionChangeRef = useRef(onSessionChange);
  const onStateChangeRef = useRef(onStateChange);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const waitForPendingFileWritesRef = useRef(waitForPendingFileWrites);
  const syncFilesRef = useRef(syncFiles);
  const onOutputRef = useRef(onOutput);
  const onCommandSentRef = useRef(onCommandSent);
  const restoredOutputRef = useRef(restoredOutput);
  const loadTerminalViewRef = useRef(loadTerminalView);
  const hasRestoredOutput = restoredOutput !== undefined && restoredOutput !== "";

  onTypeFilesRef.current = onTypeFiles;
  onWorkspaceChangeRef.current = onWorkspaceChange;
  onSessionChangeRef.current = onSessionChange;
  onStateChangeRef.current = onStateChange;
  onPhaseChangeRef.current = onPhaseChange;
  waitForPendingFileWritesRef.current = waitForPendingFileWrites;
  syncFilesRef.current = syncFiles;
  onOutputRef.current = onOutput;
  onCommandSentRef.current = onCommandSent;
  restoredOutputRef.current = restoredOutput;
  loadTerminalViewRef.current = loadTerminalView;

  const observeResize = useCallback((view: TerminalView, host: HTMLElement) => {
    if (resizeObserver.current !== undefined) return;
    resizeObserver.current = new ResizeObserver(() => {
      const size = view.fit();
      terminalSession.current?.resize(size);
    });
    resizeObserver.current.observe(host);
  }, []);

  const getView = useCallback((): Promise<TerminalView> => {
    if (viewPromise.current === undefined) {
      const next = loadTerminalViewRef.current();
      viewPromise.current = next;
      next.catch(() => {
        if (viewPromise.current === next) viewPromise.current = undefined;
      });
    }
    return viewPromise.current;
  }, []);

  const transition = useCallback((nextState: PanelState) => {
    if (!mounted.current) return;
    setState(nextState);
    if (nextState.kind === "failed") lastFailure.current = nextState.message;
    onStateChangeRef.current?.(nextState.kind);
    onPhaseChangeRef.current?.(
      nextState.kind === "preparing" ? nextState.phase : undefined,
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    onStateChangeRef.current?.("unstarted");
    return () => {
      mounted.current = false;
      attemptGeneration.current += 1;
      startupAbort.current?.abort();
      startupAbort.current = undefined;
      inputSubscription.current?.dispose();
      resizeObserver.current?.disconnect();
      const view = terminalView.current;
      terminalView.current = undefined;
      if (view !== undefined) disposeView(view);
      void viewPromise.current?.then(disposeView, () => undefined);
      viewPromise.current = undefined;
      viewOpened.current = false;
      inputSubscribed.current = false;
      restoreStarted.current = false;
      restoredViewOpened.current = false;
      resizeObserver.current = undefined;
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
      !hasRestoredOutput ||
      restoreStarted.current ||
      viewOpened.current ||
      terminalHost.current === null
    ) {
      return;
    }
    restoreStarted.current = true;
    const output = restoredOutput;
    const endMeasure = startMeasure("code-explorer:replay-terminal-output");
    void getView().then(
      (view) => {
        const host = terminalHost.current;
        if (!mounted.current || host === null || viewOpened.current) return;
        terminalView.current = view;
        view.open(host);
        viewOpened.current = true;
        restoredViewOpened.current = true;
        view.fit();
        observeResize(view, host);
        view.write(output, endMeasure);
      },
      () => {
        restoreStarted.current = false;
      },
    );
  }, [getView, hasRestoredOutput, observeResize, restoredOutput]);

  useEffect(() => {
    if (
      (state.kind !== "ready" && state.kind !== "exited") ||
      terminalHost.current === null ||
      terminalView.current === undefined ||
      terminalSession.current === undefined
    ) {
      return;
    }

    const view = terminalView.current;
    const session = terminalSession.current;
    if (!viewOpened.current) {
      view.open(terminalHost.current);
      viewOpened.current = true;
    }
    if (inputSubscribed.current) return;
    inputSubscribed.current = true;
    for (const chunk of pendingOutput.current.splice(0)) view.write(chunk);
    inputSubscription.current = view.onData((data) => {
      void waitForPendingFileWritesRef
        .current()
        .then(() => {
          if (data.includes("\r")) onCommandSentRef.current?.();
          return session.writeInput(data);
        })
        .catch(() => undefined);
    });
    session.resize(view.fit());
    observeResize(view, terminalHost.current);
    view.focus();
  }, [observeResize, state.kind]);

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

    const emitOutput = (chunk: string) => {
      if (viewOpened.current) {
        terminalView.current?.write(chunk);
      } else {
        pendingOutput.current.push(chunk);
      }
      onOutputRef.current?.(chunk);
    };

    let view: TerminalView | undefined;
    let session: TerminalSession | undefined;
    let announced = false;
    try {
      view = await getView();
      if (!isActiveAttempt()) {
        if (!restoredViewOpened.current && !(mounted.current && starting.current)) {
          viewPromise.current = undefined;
          disposeView(view);
        }
        return;
      }
      terminalView.current = view;
      const hasRestoredOutputAtStart =
        restoredOutputRef.current !== undefined &&
        restoredOutputRef.current !== "";
      if (hasRestoredOutputAtStart && !delimiterWritten.current) {
        delimiterWritten.current = true;
        emitOutput(previousOutputDelimiter);
      }
      const runner = runnerFactory();
      session = await runner.start({
        files,
        visibleFiles,
        size: initialTerminalSize,
        signal: controller.signal,
        skipDepsSnapshot: skipDepsSnapshot.current,
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
            firstLoaded: downloadProgress.current?.firstLoaded ?? progress.loaded,
          };
        },
        onOutput: (chunk) => {
          if (isActiveAttempt()) emitOutput(chunk);
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
        disposeView(view);
        return;
      }
      onSessionChangeRef.current(session);
      announced = true;
      await syncFilesRef.current?.(files);
      if (!isActiveAttempt()) {
        await session.dispose();
        onSessionChangeRef.current(undefined);
        return;
      }
      if (initialCommand !== undefined && !hasRestoredOutputAtStart) {
        onCommandSentRef.current?.();
        await session.writeInput(`${initialCommand}\r`);
        if (!isActiveAttempt()) {
          await session.dispose();
          onSessionChangeRef.current(undefined);
          return;
        }
      }
      terminalSession.current = session;
      session = undefined;
      const exitCode = pendingExitCode.current;
      pendingExitCode.current = undefined;
      transition(
        exitCode === undefined
          ? { kind: "ready" }
          : { kind: "exited", exitCode, restarting: false },
      );
    } catch (error: unknown) {
      if (
        error instanceof TerminalPreparationTimeoutError &&
        error.phase === "restoring-deps"
      ) {
        skipDepsSnapshot.current = true;
      }
      if (session !== undefined) {
        await session.dispose();
        if (announced) onSessionChangeRef.current(undefined);
      }
      if (
        view !== undefined &&
        terminalView.current === view &&
        !restoredViewOpened.current
      ) {
        terminalView.current = undefined;
        viewPromise.current = undefined;
        disposeView(view);
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
    getView,
    initialCommand,
    runnerFactory,
    supportsRuntime,
    transition,
    visibleFiles,
  ]);

  const startTracked = useCallback((): Promise<void> => {
    if (starting.current && startPromise.current !== undefined) {
      return startPromise.current;
    }
    lastFailure.current = undefined;
    const next = startTerminal();
    startPromise.current = next;
    return next;
  }, [startTerminal]);

  useImperativeHandle(
    ref,
    () => ({
      ensureSession: async () => {
        if (terminalSession.current === undefined) await startTracked();
        const session = terminalSession.current;
        if (session === undefined) {
          throw new Error(
            lastFailure.current ?? "ターミナルを起動できませんでした。",
          );
        }
        return session;
      },
      releaseSession: async () => {
        const session = terminalSession.current;
        if (session === undefined) return;
        terminalSession.current = undefined;
        attemptGeneration.current += 1;
        onSessionChangeRef.current(undefined);
        inputSubscription.current?.dispose();
        inputSubscription.current = undefined;
        inputSubscribed.current = false;
        if (!restoredViewOpened.current) {
          resizeObserver.current?.disconnect();
          resizeObserver.current = undefined;
          const view = terminalView.current;
          terminalView.current = undefined;
          viewPromise.current = undefined;
          viewOpened.current = false;
          if (view !== undefined) disposeView(view);
        }
        transition({ kind: "unstarted" });
        await session.dispose().catch(() => undefined);
      },
    }),
    [startTracked, transition],
  );

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
      resizeObserver.current = undefined;
      disposeView(view);
      terminalView.current = undefined;
      viewPromise.current = undefined;
      viewOpened.current = false;
      inputSubscribed.current = false;
      restoredViewOpened.current = false;
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

  const showsTerminal =
    state.kind === "ready" || state.kind === "exited" || hasRestoredOutput;

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
            disabled={startDisabled}
            onClick={() => void startTracked()}
          >
            {hasRestoredOutput || hasEdits || initialCommand === undefined
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
            onClick={() => void startTracked()}
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
          {state.kind === "unstarted" && hasRestoredOutput ? (
            <div className="code-explorer__terminal-status" role="status">
              <p>前回の出力です。入力するには、ターミナルを起動してください。</p>
              {outputStale ? <p>この出力は編集の前のものです。</p> : null}
            </div>
          ) : null}
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
});

TerminalPanel.displayName = "TerminalPanel";
