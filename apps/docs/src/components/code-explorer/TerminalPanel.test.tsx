import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TerminalInstallError,
  TerminalPreparationTimeoutError,
  type TerminalSession,
  type TerminalStartRequest,
} from "../../code-explorer/runner";
import {
  TerminalPanel,
  type TerminalPanelController,
  type TerminalPanelProps,
  type TerminalView,
} from "./TerminalPanel";

const files = {
  "src/main.ts": "export const value = 1;",
  "package.json": "{}",
} as const;

const createSession = (): TerminalSession => ({
  writeInput: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  resize: vi.fn(),
  restartShell: vi.fn(async () => undefined),
  dispose: vi.fn(async () => undefined),
});

const createView = (): TerminalView => ({
  open: vi.fn(),
  write: vi.fn(),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  fit: vi.fn(() => ({ cols: 100, rows: 30 })),
  focus: vi.fn(),
  dispose: vi.fn(),
});

const roots: Root[] = [];
const disconnectObserver = vi.fn();

const defaultProps = (): TerminalPanelProps => ({
  files,
  visibleFiles: ["src/main.ts"],
  runnerFactory: () => ({
    start: async () => createSession(),
  }),
  supportsRuntime: () => true,
  prefetchDeps: vi.fn(async () => undefined),
  loadTerminalView: async () => createView(),
  onTypeFiles: vi.fn(),
  onWorkspaceChange: vi.fn(),
  onSessionChange: vi.fn(),
  onStateChange: vi.fn(),
  outputStale: false,
  startDisabled: false,
  hasEdits: false,
});

const renderPanel = async (props: Partial<TerminalPanelProps> = {}) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(<TerminalPanel {...defaultProps()} {...props} />);
  });
  return host;
};

const clickAction = async (host: HTMLElement, action: string) => {
  await act(async () => {
    host
      .querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
      ?.click();
  });
};

describe("TerminalPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    disconnectObserver.mockReset();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = disconnectObserver;
      },
    );
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots.splice(0)) root.unmount();
    });
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("disposes a terminal view after startup fails", async () => {
    const failedView = createView();
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async () => {
          throw new Error("boot failed");
        },
      }),
      loadTerminalView: async () => failedView,
    });

    await clickAction(host, "start-terminal");

    expect(failedView.dispose).toHaveBeenCalledOnce();
  });

  it("releases a session when sending its initial command fails", async () => {
    const session = createSession();
    vi.mocked(session.writeInput).mockRejectedValueOnce(new Error("write failed"));
    const host = await renderPanel({
      initialCommand: "pnpm exercise:01",
      runnerFactory: () => ({ start: async () => session }),
    });

    await clickAction(host, "start-terminal");

    expect(session.writeInput).toHaveBeenCalledWith("pnpm exercise:01\r");
    expect(session.dispose).toHaveBeenCalledOnce();
    expect(host.querySelector('[data-action="retry-terminal"]')).not.toBeNull();
  });

  it("releases a session when unmounted during the initial command", async () => {
    const session = createSession();
    let resolveWrite!: () => void;
    vi.mocked(session.writeInput).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    const host = await renderPanel({
      initialCommand: "pnpm exercise:01",
      runnerFactory: () => ({ start: async () => session }),
    });

    act(() =>
      host
        .querySelector<HTMLButtonElement>('[data-action="start-terminal"]')
        ?.click(),
    );
    await act(async () => undefined);
    expect(session.writeInput).toHaveBeenCalledOnce();

    const root = roots.pop()!;
    await act(async () => root.unmount());
    await act(async () => resolveWrite());

    expect(session.dispose).toHaveBeenCalledOnce();
  });

  it("releases terminal, observer, input, and session resources on unmount", async () => {
    const session = createSession();
    const view = createView();
    const inputSubscription = { dispose: vi.fn() };
    vi.mocked(view.onData).mockReturnValue(inputSubscription);
    const onSessionChange = vi.fn();
    const host = await renderPanel({
      runnerFactory: () => ({ start: async () => session }),
      loadTerminalView: async () => view,
      onSessionChange,
    });
    await clickAction(host, "start-terminal");

    const root = roots.pop()!;
    await act(async () => root.unmount());

    expect(inputSubscription.dispose).toHaveBeenCalledOnce();
    expect(disconnectObserver).toHaveBeenCalledOnce();
    expect(view.dispose).toHaveBeenCalledOnce();
    expect(session.dispose).toHaveBeenCalledOnce();
    expect(onSessionChange).toHaveBeenLastCalledWith(undefined);
  });

  it("aborts startup and disposes its view when unmounted during installation", async () => {
    const view = createView();
    let request: TerminalStartRequest | undefined;
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async (nextRequest) => {
          request = nextRequest;
          return new Promise<TerminalSession>((_resolve, reject) => {
            nextRequest.signal.addEventListener(
              "abort",
              () => reject(nextRequest.signal.reason),
              { once: true },
            );
          });
        },
      }),
      loadTerminalView: async () => view,
    });
    await clickAction(host, "start-terminal");

    const root = roots.pop()!;
    await act(async () => root.unmount());
    await act(async () => undefined);

    expect(request?.signal.aborted).toBe(true);
    expect(view.dispose).toHaveBeenCalledOnce();
  });

  it("shows elapsed seconds and download progress while preparing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const megabyte = 1024 * 1024;
    let request: TerminalStartRequest | undefined;
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async (nextRequest) => {
          request = nextRequest;
          return new Promise<TerminalSession>(() => undefined);
        },
      }),
    });
    await clickAction(host, "start-terminal");
    await act(async () => {
      request?.onPhase("downloading-deps");
      request?.onDownloadProgress?.({ loaded: 0, total: 20 * megabyte });
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
      request?.onDownloadProgress?.({ loaded: 4 * megabyte, total: 20 * megabyte });
      vi.advanceTimersByTime(1000);
    });

    expect(host.querySelector('[role="status"]')?.textContent).toBe(
      "依存パッケージを取得しています。",
    );
    const detail = host.querySelector('[aria-hidden="true"]');
    expect(detail?.textContent).toContain("経過 2秒");
    expect(detail?.textContent).toContain("4 / 20 MB");
    expect(detail?.textContent).toContain("残り約8秒");
    const progress = detail?.querySelector("progress");
    expect(progress?.getAttribute("max")).toBe(String(20 * megabyte));
    expect(progress?.getAttribute("value")).toBe(String(4 * megabyte));
    vi.useRealTimers();
  });

  it("returns to the unstarted state when preparation is cancelled", async () => {
    let request: TerminalStartRequest | undefined;
    const onStateChange = vi.fn();
    const host = await renderPanel({
      onStateChange,
      runnerFactory: () => ({
        start: async (nextRequest) => {
          request = nextRequest;
          return new Promise<TerminalSession>((_resolve, reject) => {
            nextRequest.signal.addEventListener(
              "abort",
              () => reject(nextRequest.signal.reason),
              { once: true },
            );
          });
        },
      }),
    });
    await clickAction(host, "start-terminal");

    await clickAction(host, "cancel-terminal");
    await act(async () => undefined);

    expect(request?.signal.aborted).toBe(true);
    expect(onStateChange).toHaveBeenLastCalledWith("unstarted");
    expect(host.querySelector('[data-action="start-terminal"]')).not.toBeNull();
    expect(host.querySelector('[data-action="retry-terminal"]')).toBeNull();
  });

  describe("while preparing with a previous output", () => {
    const neverStarts = (): TerminalPanelProps["runnerFactory"] => () => ({
      start: (request) =>
        new Promise<TerminalSession>((_resolve, reject) => {
          request.signal.addEventListener(
            "abort",
            () => reject(request.signal.reason),
            { once: true },
          );
        }),
    });
    const note =
      "前回の出力は残っています。ターミナルだけを準備しています。準備をやめても、前回の出力と結果は消えません。";

    it("tells that the previous output stays, and keeps it after the preparation is cancelled", async () => {
      const view = createView();
      const onOutput = vi.fn();
      const host = await renderPanel({
        runnerFactory: neverStarts(),
        loadTerminalView: async () => view,
        restoredOutput: "前回の出力\r\n",
        onOutput,
      });
      await act(async () => undefined);
      await clickAction(host, "start-terminal");

      expect(host.querySelector(".code-explorer__terminal-status")?.textContent).toContain(note);

      await clickAction(host, "cancel-terminal");
      await act(async () => undefined);

      expect(host.textContent).not.toContain(note);
      expect(host.textContent).toContain("前回の出力です。");
      expect(view.dispose).not.toHaveBeenCalled();
      expect(view.write).toHaveBeenCalledWith("前回の出力\r\n", expect.anything());
    });

    it("does not tell it when there is no previous output", async () => {
      const host = await renderPanel({ runnerFactory: neverStarts() });
      await clickAction(host, "start-terminal");

      expect(host.textContent).not.toContain(note);
    });
  });

  it.each([
    [
      "booting",
      "実行環境の起動が時間内に終わりませんでした。ネットワークの接続を確認してから「ターミナルを再試行」を押してください。",
    ],
    [
      "installing",
      "依存パッケージのインストールが時間内に終わりませんでした。ネットワークの接続を確認してから「ターミナルを再試行」を押してください。",
    ],
    [
      "restoring-deps",
      "準備が時間内に終わりませんでした。「ターミナルを再試行」を押してください。",
    ],
  ] as const)("explains a %s timeout in Japanese and points to the answer example", async (phase, message) => {
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async () => {
          throw new TerminalPreparationTimeoutError(phase);
        },
      }),
    });

    await clickAction(host, "start-terminal");

    expect(host.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(host.querySelector('a[href="/setup/"]')).toBeNull();
    expect(host.textContent).toContain(
      "繰り返し失敗するときは、このSessionの「演習」ページにある「解答の例を見る」を開いてください。",
    );
  });

  it("explains an install failure without showing the English error", async () => {
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async () => {
          throw new TerminalInstallError(1);
        },
      }),
    });

    await clickAction(host, "start-terminal");

    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "依存パッケージの取得に失敗しました。ネットワークの接続を確認してから「ターミナルを再試行」を押してください。",
    );
    expect(host.textContent).not.toContain("Dependency installation failed");
    expect(host.querySelector('a[href="/setup/"]')).toBeNull();
    expect(host.textContent).toContain("「解答の例を見る」を開いてください。");
  });

  it("does not show an unclassified English error message", async () => {
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async () => {
          throw new Error("boot failed");
        },
      }),
    });

    await clickAction(host, "start-terminal");

    expect(host.textContent).not.toContain("boot failed");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "ターミナルの起動中にエラーが発生しました。「ターミナルを再試行」を押してください。",
    );
    expect(host.querySelector('a[href="/setup/"]')).toBeNull();
    expect(host.textContent).toContain("「解答の例を見る」を開いてください。");
  });

  it("estimates the remaining time from the bytes received after the first report", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const megabyte = 1024 * 1024;
    let request: TerminalStartRequest | undefined;
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async (nextRequest) => {
          request = nextRequest;
          return new Promise<TerminalSession>(() => undefined);
        },
      }),
    });
    await clickAction(host, "start-terminal");
    await act(async () => {
      request?.onPhase("downloading-deps");
      request?.onDownloadProgress?.({ loaded: 10 * megabyte, total: 20 * megabyte });
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
      request?.onDownloadProgress?.({ loaded: 12 * megabyte, total: 20 * megabyte });
      vi.advanceTimersByTime(1000);
    });

    const detail = host.querySelector('[aria-hidden="true"]');
    expect(detail?.textContent).toContain("12 / 20 MB");
    expect(detail?.textContent).toContain("残り約8秒");
    vi.useRealTimers();
  });

  it("uses a new view when the first attempt was cancelled while the view loaded", async () => {
    const staleView = createView();
    const freshView = createView();
    const staleLoad = Promise.withResolvers<TerminalView>();
    const loadTerminalView = vi
      .fn<() => Promise<TerminalView>>()
      .mockReturnValueOnce(staleLoad.promise)
      .mockResolvedValueOnce(freshView);
    const host = await renderPanel({ loadTerminalView });
    await clickAction(host, "start-terminal");
    await clickAction(host, "cancel-terminal");

    await act(async () => staleLoad.resolve(staleView));
    await clickAction(host, "start-terminal");
    await act(async () => undefined);

    expect(staleView.dispose).toHaveBeenCalledOnce();
    expect(staleView.open).not.toHaveBeenCalled();
    expect(loadTerminalView).toHaveBeenCalledTimes(2);
    expect(freshView.open).toHaveBeenCalledOnce();
    expect(freshView.dispose).not.toHaveBeenCalled();
  });

  it("keeps the view for a restart that began while the first attempt was still loading it", async () => {
    const view = createView();
    const load = Promise.withResolvers<TerminalView>();
    const loadTerminalView = vi.fn(() => load.promise);
    const host = await renderPanel({ loadTerminalView });
    await clickAction(host, "start-terminal");
    await clickAction(host, "cancel-terminal");
    await clickAction(host, "start-terminal");

    await act(async () => load.resolve(view));
    await act(async () => undefined);

    expect(loadTerminalView).toHaveBeenCalledOnce();
    expect(view.dispose).not.toHaveBeenCalled();
    expect(view.open).toHaveBeenCalledOnce();
  });

  it("skips the dependency snapshot after restoring timed out", async () => {
    const requests: TerminalStartRequest[] = [];
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async (request) => {
          requests.push(request);
          throw new TerminalPreparationTimeoutError("restoring-deps");
        },
      }),
    });

    await clickAction(host, "start-terminal");
    await clickAction(host, "retry-terminal");

    expect(requests.map(({ skipDepsSnapshot }) => skipDepsSnapshot)).toEqual([
      false,
      true,
    ]);
  });

  it("keeps using the dependency snapshot after other failures", async () => {
    const requests: TerminalStartRequest[] = [];
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async (request) => {
          requests.push(request);
          throw new TerminalPreparationTimeoutError("installing");
        },
      }),
    });

    await clickAction(host, "start-terminal");
    await clickAction(host, "retry-terminal");

    expect(requests.map(({ skipDepsSnapshot }) => skipDepsSnapshot)).toEqual([
      false,
      false,
    ]);
  });

  it("prefetches dependencies after mounting unless data saving is on", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const prefetchDeps = vi.fn(async () => undefined);
    await renderPanel({ prefetchDeps });
    expect(prefetchDeps).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(prefetchDeps).toHaveBeenCalledOnce();

    vi.stubGlobal("navigator", { connection: { saveData: true } });
    const saved = vi.fn(async () => undefined);
    await renderPanel({ prefetchDeps: saved });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(saved).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("TerminalPanel controller", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots.splice(0)) root.unmount();
    });
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  const renderWithController = async (
    props: Partial<TerminalPanelProps> = {},
  ) => {
    const ref = createRef<TerminalPanelController>();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    await act(async () => {
      root.render(<TerminalPanel ref={ref} {...defaultProps()} {...props} />);
    });
    return { host, ref };
  };

  it("starts the terminal on request and returns its session", async () => {
    const session = createSession();
    const start = vi.fn(async () => session);
    const { host, ref } = await renderWithController({
      runnerFactory: () => ({ start }),
    });

    let acquired: TerminalSession | undefined;
    await act(async () => {
      acquired = await ref.current?.ensureSession();
    });

    expect(acquired).toBe(session);
    expect(start).toHaveBeenCalledOnce();
    expect(host.querySelector("[data-state]")?.getAttribute("data-state")).toBe(
      "ready",
    );
  });

  it("returns the running session without starting another", async () => {
    const start = vi.fn(async () => createSession());
    const { ref } = await renderWithController({
      runnerFactory: () => ({ start }),
    });

    await act(async () => {
      await ref.current?.ensureSession();
      await ref.current?.ensureSession();
    });

    expect(start).toHaveBeenCalledOnce();
  });

  it("shares one startup between requests made while it is in progress", async () => {
    let finish!: (session: TerminalSession) => void;
    const start = vi.fn(
      () =>
        new Promise<TerminalSession>((resolve) => {
          finish = resolve;
        }),
    );
    const { ref } = await renderWithController({
      runnerFactory: () => ({ start }),
    });
    const session = createSession();

    let acquired: TerminalSession[] = [];
    await act(async () => {
      const first = ref.current?.ensureSession();
      const second = ref.current?.ensureSession();
      await Promise.resolve();
      finish(session);
      acquired = await Promise.all([first!, second!]);
    });

    expect(start).toHaveBeenCalledOnce();
    expect(acquired).toEqual([session, session]);
  });

  it("joins a startup that the start button began", async () => {
    let finish!: (session: TerminalSession) => void;
    const start = vi.fn(
      () =>
        new Promise<TerminalSession>((resolve) => {
          finish = resolve;
        }),
    );
    const { host, ref } = await renderWithController({
      runnerFactory: () => ({ start }),
    });
    const session = createSession();

    let acquired: TerminalSession | undefined;
    await act(async () => {
      host
        .querySelector<HTMLButtonElement>('[data-action="start-terminal"]')
        ?.click();
      await Promise.resolve();
      const pending = ref.current?.ensureSession();
      finish(session);
      acquired = await pending;
    });

    expect(start).toHaveBeenCalledOnce();
    expect(acquired).toBe(session);
  });

  it("rejects with the startup failure message", async () => {
    const { ref } = await renderWithController({
      runnerFactory: () => ({
        start: async () => {
          throw new Error("boot failed");
        },
      }),
    });

    await act(async () => {
      await expect(ref.current?.ensureSession()).rejects.toThrow(
        "ターミナルの起動中にエラーが発生しました。「ターミナルを再試行」を押してください。",
      );
    });
  });

  it("rejects with the reason when the runtime is not supported", async () => {
    const { ref } = await renderWithController({ supportsRuntime: () => false });

    await act(async () => {
      await expect(ref.current?.ensureSession()).rejects.toThrow(
        "ChromeまたはEdgeで開き",
      );
    });
  });

  it("reports each startup phase and clears it when the terminal is ready", async () => {
    const onPhaseChange = vi.fn();
    const { ref } = await renderWithController({
      onPhaseChange,
      runnerFactory: () => ({
        start: async (request) => {
          request.onPhase("mounting");
          request.onPhase("installing");
          return createSession();
        },
      }),
    });

    await act(async () => {
      await ref.current?.ensureSession();
    });

    expect(onPhaseChange.mock.calls.map(([phase]) => phase)).toEqual([
      "booting",
      "mounting",
      "installing",
      undefined,
    ]);
  });
});
