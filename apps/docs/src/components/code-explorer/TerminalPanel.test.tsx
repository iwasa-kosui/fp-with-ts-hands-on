import { act } from "react";
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
      initialCommand: "pnpm exercise:02",
      runnerFactory: () => ({ start: async () => session }),
    });

    await clickAction(host, "start-terminal");

    expect(session.writeInput).toHaveBeenCalledWith("pnpm exercise:02\r");
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
      initialCommand: "pnpm exercise:02",
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

  it("explains a preparation timeout in Japanese with a link to the setup page", async () => {
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async () => {
          throw new TerminalPreparationTimeoutError("installing");
        },
      }),
    });

    await clickAction(host, "start-terminal");

    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "準備が時間内に終わりませんでした。ネットワークの接続を確かめてから「ターミナルを再試行」を押してください。",
    );
    expect(host.querySelector('a[href="/setup/"]')?.textContent).toBe(
      "環境構築のページ",
    );
    expect(host.textContent).toContain(
      "繰り返し失敗するときは、環境構築のページの手順で手元で進めてください。",
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
      "依存パッケージの取得に失敗しました。ネットワークの接続を確かめてから「ターミナルを再試行」を押してください。",
    );
    expect(host.textContent).not.toContain("Dependency installation failed");
    expect(host.querySelector('a[href="/setup/"]')).not.toBeNull();
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
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
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
