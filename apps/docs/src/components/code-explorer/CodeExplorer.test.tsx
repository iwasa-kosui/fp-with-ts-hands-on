import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TerminalSession } from "../../code-explorer/runner";
import type { EditorProps } from "./CodeExplorer";
import { CodeExplorer } from "./CodeExplorer";
import type { TerminalView } from "./TerminalPanel";

const TestEditor: ComponentType<EditorProps> = ({ value, onChange }) => (
  <textarea
    aria-label="コードエディタ"
    value={value}
    onChange={(event) => onChange(event.currentTarget.value)}
  />
);

const workspace = {
  slug: "02-state-transitions",
  snapshot: "session-02",
  description: "状態遷移を編集します。",
  initialFile: "src/example.ts",
  visibleFiles: ["src/example.ts"],
} as const;

const files = {
  "src/example.ts": "export const value = 1;",
  "package.json": "{}",
} as const;

const roots: Root[] = [];

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
};

const createHarness = async () => {
  let inputListener: ((data: string) => void) | undefined;
  const view: TerminalView = {
    open: vi.fn(),
    write: vi.fn(),
    onData: vi.fn((listener) => {
      inputListener = listener;
      return { dispose: vi.fn() };
    }),
    fit: vi.fn(() => ({ cols: 100, rows: 30 })),
    focus: vi.fn(),
    dispose: vi.fn(),
  };
  const session: TerminalSession = {
    writeInput: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
    resize: vi.fn(),
    restartShell: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);

  await act(async () => {
    root.render(
      <CodeExplorer
        workspace={workspace}
        projectFiles={files}
        Editor={TestEditor}
        supportsRuntime={() => true}
        loadTerminalView={async () => view}
        runnerFactory={() => ({ start: async () => session })}
      />,
    );
  });
  await act(async () => {
    host
      .querySelector<HTMLButtonElement>('[data-action="start-terminal"]')
      ?.click();
  });

  return {
    host,
    session,
    sendTerminalInput: (data: string) => inputListener?.(data),
  };
};

const editCurrentFile = async (host: HTMLElement, value: string) => {
  const editor = host.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="コードエディタ"]',
  )!;
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setValue.call(editor, value);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("CodeExplorer file synchronization", () => {
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

  it("waits for pasted editor contents before rerunning the exercise", async () => {
    const write = deferred();
    const { host, session, sendTerminalInput } = await createHarness();
    vi.mocked(session.writeFile).mockReturnValueOnce(write.promise);

    await editCurrentFile(host, "export const value = 2;");
    sendTerminalInput("pnpm exercise:02\r");
    await act(async () => undefined);

    expect(session.writeInput).not.toHaveBeenCalled();

    await act(async () => write.resolve());

    expect(session.writeInput).toHaveBeenCalledWith("pnpm exercise:02\r");
  });

  it("waits for reset contents before rerunning the exercise", async () => {
    const resetWrite = deferred();
    const { host, session, sendTerminalInput } = await createHarness();
    await editCurrentFile(host, "export const value = 2;");
    await act(async () => undefined);
    vi.mocked(session.writeFile).mockReturnValueOnce(resetWrite.promise);

    await act(async () => {
      host
        .querySelector<HTMLButtonElement>('[data-action="reset"]')
        ?.click();
    });
    sendTerminalInput("pnpm exercise:02\r");
    await act(async () => undefined);

    expect(session.writeInput).not.toHaveBeenCalled();

    await act(async () => resetWrite.resolve());

    expect(session.writeInput).toHaveBeenCalledWith("pnpm exercise:02\r");
  });

  it("does not rerun stale contents when editor synchronization fails", async () => {
    const write = deferred();
    const { host, session, sendTerminalInput } = await createHarness();
    vi.mocked(session.writeFile).mockReturnValueOnce(write.promise);

    await editCurrentFile(host, "export const value = 2;");
    sendTerminalInput("pnpm exercise:02\r");
    await act(async () => write.reject(new Error("sync failed")));

    expect(session.writeInput).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("sync failed");
  });
});
