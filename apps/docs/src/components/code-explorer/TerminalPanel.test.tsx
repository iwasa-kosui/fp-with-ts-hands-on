import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TerminalRunner,
  TerminalSession,
  TerminalStartRequest,
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
let resizeCallback:
  | ((entries: ResizeObserverEntry[], observer: ResizeObserver) => void)
  | undefined;
const disconnectObserver = vi.fn();

const defaultProps = (): TerminalPanelProps => ({
  files,
  visibleFiles: ["src/main.ts"],
  runnerFactory: () => ({
    start: async () => createSession(),
  }),
  supportsRuntime: () => true,
  loadTerminalView: async () => createView(),
  onTypeFiles: vi.fn(),
  onWorkspaceChange: vi.fn(),
  onSessionChange: vi.fn(),
  onStateChange: vi.fn(),
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
    resizeCallback = undefined;
    disconnectObserver.mockReset();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: typeof resizeCallback) {
          resizeCallback = callback;
        }

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

  it("boots only after an explicit action and connects the terminal view", async () => {
    const session = createSession();
    const view = createView();
    const states: string[] = [];
    let request: TerminalStartRequest | undefined;
    let inputListener: ((data: string) => void) | undefined;
    vi.mocked(view.onData).mockImplementation((listener) => {
      inputListener = listener;
      return { dispose: vi.fn() };
    });
    const runner: TerminalRunner = {
      start: async (nextRequest) => {
        request = nextRequest;
        nextRequest.onPhase("booting");
        nextRequest.onPhase("installing");
        nextRequest.onOutput("\x1b[32mready\x1b[0m\r\n");
        nextRequest.onTypeFiles({
          "file:///node_modules/vitest/index.d.ts": "types",
        });
        return session;
      },
    };
    const onTypeFiles = vi.fn();
    const onSessionChange = vi.fn();
    const host = await renderPanel({
      runnerFactory: () => runner,
      loadTerminalView: async () => view,
      onTypeFiles,
      onSessionChange,
      onStateChange: (state) => states.push(state),
    });

    expect(host.textContent).toContain("ブラウザ内の隔離環境");
    expect(host.querySelector('[aria-label="コード実行ターミナル"]')).toBeNull();
    expect(request).toBeUndefined();

    await clickAction(host, "start-terminal");

    expect(request?.files).toEqual(files);
    expect(request?.visibleFiles).toEqual(["src/main.ts"]);
    expect(request?.size).toEqual({ cols: 80, rows: 24 });
    expect(states).toContain("preparing");
    expect(states.at(-1)).toBe("ready");
    expect(onTypeFiles).toHaveBeenCalledWith({
      "file:///node_modules/vitest/index.d.ts": "types",
    });
    expect(onSessionChange).toHaveBeenCalledWith(session);
    expect(view.open).toHaveBeenCalledOnce();
    expect(view.write).toHaveBeenCalledWith("\x1b[32mready\x1b[0m\r\n");
    expect(view.focus).toHaveBeenCalledOnce();
    expect(session.resize).toHaveBeenCalledWith({ cols: 100, rows: 30 });

    inputListener?.("pwd\r");
    await act(async () => undefined);
    expect(session.writeInput).toHaveBeenCalledWith("pwd\r");

    resizeCallback?.([], {} as ResizeObserver);
    expect(view.fit).toHaveBeenCalledTimes(2);
    expect(session.resize).toHaveBeenLastCalledWith({ cols: 100, rows: 30 });
  });

  it("explains an unsupported browser without creating a runner", async () => {
    const runnerFactory = vi.fn<() => TerminalRunner>();
    const host = await renderPanel({
      supportsRuntime: () => false,
      runnerFactory,
    });

    await clickAction(host, "start-terminal");

    expect(runnerFactory).not.toHaveBeenCalled();
    expect(host.textContent).toContain(
      "ChromeまたはEdgeで開き、サイトの分離ヘッダーを確認してください。",
    );
    expect(host.querySelector('[data-action="retry-terminal"]')).not.toBeNull();
  });

  it("disposes a failed attempt and retries from a fresh runner", async () => {
    const session = createSession();
    const failedView = createView();
    const recoveredView = createView();
    const views = [failedView, recoveredView];
    let attempts = 0;
    const runnerFactory = vi.fn<() => TerminalRunner>(() => ({
      start: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("boot failed");
        return session;
      },
    }));
    const host = await renderPanel({
      runnerFactory,
      loadTerminalView: async () => views.shift()!,
    });

    await clickAction(host, "start-terminal");
    expect(host.textContent).toContain("boot failed");
    expect(failedView.dispose).toHaveBeenCalledOnce();

    await clickAction(host, "retry-terminal");
    expect(runnerFactory).toHaveBeenCalledTimes(2);
    expect(recoveredView.open).toHaveBeenCalledOnce();
    expect(host.querySelector('[aria-label="コード実行ターミナル"]')).not.toBeNull();
  });

  it("restarts an exited shell without discarding its session", async () => {
    const session = createSession();
    const view = createView();
    let request: TerminalStartRequest | undefined;
    const host = await renderPanel({
      runnerFactory: () => ({
        start: async (nextRequest) => {
          request = nextRequest;
          return session;
        },
      }),
      loadTerminalView: async () => view,
    });
    await clickAction(host, "start-terminal");

    await act(async () => request?.onExit(0));
    expect(host.textContent).toContain("シェルが終了しました（終了コード 0）。");

    await clickAction(host, "restart-terminal");
    expect(session.restartShell).toHaveBeenCalledWith({ cols: 100, rows: 30 });
    expect(host.textContent).not.toContain("シェルが終了しました");
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
});
