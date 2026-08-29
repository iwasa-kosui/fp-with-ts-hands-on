import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
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
});
