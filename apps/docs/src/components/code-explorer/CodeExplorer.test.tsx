import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TerminalSession,
  TerminalStartRequest,
} from "../../code-explorer/runner";
import type { SessionWorkspace } from "../../code-explorer/types";
import type {
  SavedView,
  SavedWorkspace,
  WorkspaceStore,
} from "../../code-explorer/workspace-store";
import type { EditorProps } from "./CodeExplorer";
import { CodeExplorer } from "./CodeExplorer";
import type { TerminalView } from "./TerminalPanel";

const TestEditor: ComponentType<EditorProps> = ({
  value,
  disabled,
  onChange,
}) => (
  <textarea
    aria-label="コードエディタ"
    value={value}
    disabled={disabled}
    onChange={(event) => onChange(event.currentTarget.value)}
  />
);

const workspace = {
  slug: "01-state-transitions",
  snapshot: "session-01",
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

type MemoryStore = WorkspaceStore & {
  saveEdits: ReturnType<typeof vi.fn<WorkspaceStore["saveEdits"]>>;
  load: ReturnType<typeof vi.fn<WorkspaceStore["load"]>>;
  revisionOf: (slug: string) => number;
  editsOf: (slug: string) => SavedWorkspace["edits"] | undefined;
  seed: (workspace: SavedWorkspace, view?: SavedView) => void;
  viewOf: (slug: string) => SavedView | undefined;
  setView: (view: SavedView) => void;
  saveTerminalOutput: ReturnType<
    typeof vi.fn<WorkspaceStore["saveTerminalOutput"]>
  >;
  saveSelectedPath: ReturnType<
    typeof vi.fn<WorkspaceStore["saveSelectedPath"]>
  >;
  writeAsOtherTab: (
    slug: string,
    edits: SavedWorkspace["edits"],
    notify: boolean,
  ) => number;
};

const createMemoryStore = (): MemoryStore => {
  const workspaces = new Map<string, SavedWorkspace>();
  const views = new Map<string, SavedView>();
  const listeners = new Set<{
    slug: string;
    listener: (revision: number) => void;
  }>();
  return {
    load: vi.fn(async (slug: string) => ({
      workspace: workspaces.get(slug),
      view: views.get(slug),
    })),
    saveEdits: vi.fn(async (slug: string, edits, expectedRevision: number) => {
      const revision = workspaces.get(slug)?.revision ?? 0;
      if (revision !== expectedRevision) {
        return { kind: "conflict" as const, revision };
      }
      workspaces.set(slug, {
        slug,
        revision: revision + 1,
        edits,
        updatedAt: Date.now(),
      });
      return { kind: "saved" as const, revision: revision + 1 };
    }),
    saveTerminalOutput: vi.fn(
      async (slug: string, output: string, lastOutputAt: number) => {
        views.set(slug, {
          ...(views.get(slug) ?? { slug, output: "", lastOutputAt: 0 }),
          output,
          lastOutputAt,
        });
      },
    ),
    saveSelectedPath: vi.fn(async (slug: string, selectedPath: string) => {
      views.set(slug, {
        ...(views.get(slug) ?? { slug, output: "", lastOutputAt: 0 }),
        selectedPath,
      });
    }),
    viewOf: (slug) => views.get(slug),
    setView: (view) => {
      views.set(view.slug, view);
    },
    subscribe: (slug, listener) => {
      const entry = { slug, listener };
      listeners.add(entry);
      return () => listeners.delete(entry);
    },
    revisionOf: (slug) => workspaces.get(slug)?.revision ?? 0,
    editsOf: (slug) => workspaces.get(slug)?.edits,
    seed: (workspace, view) => {
      workspaces.set(workspace.slug, workspace);
      if (view !== undefined) views.set(view.slug, view);
    },
    writeAsOtherTab: (slug, edits, notify) => {
      const revision = (workspaces.get(slug)?.revision ?? 0) + 1;
      workspaces.set(slug, { slug, revision, edits, updatedAt: Date.now() });
      if (notify) {
        for (const entry of listeners) {
          if (entry.slug === slug) entry.listener(revision);
        }
      }
      return revision;
    },
  };
};

const savedWorkspace = (
  edits: SavedWorkspace["edits"],
  revision = 1,
): SavedWorkspace => ({
  slug: workspace.slug,
  revision,
  edits,
  updatedAt: 1000,
});

const exampleEdit = (contents: string, base: string = files["src/example.ts"]) => ({
  "src/example.ts": { contents, base },
});

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

type HarnessOptions = Readonly<{
  store?: MemoryStore;
  start?: boolean;
  initialCommand?: string;
  startSession?: (request: TerminalStartRequest) => Promise<TerminalSession>;
  workspace?: SessionWorkspace;
}>;

const createHarness = async (options: HarnessOptions = {}) => {
  let inputListener: ((data: string) => void) | undefined;
  const store = options.store ?? createMemoryStore();
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
        workspace={options.workspace ?? workspace}
        projectFiles={files}
        initialCommand={options.initialCommand}
        Editor={TestEditor}
        supportsRuntime={() => true}
        loadTerminalView={async () => view}
        runnerFactory={() => ({
          start: options.startSession ?? (async () => session),
        })}
        workspaceStore={store}
      />,
    );
  });
  await settle();
  if (options.start !== false) {
    await act(async () => {
      host
        .querySelector<HTMLButtonElement>('[data-action="start-terminal"]')
        ?.click();
    });
  }

  return {
    host,
    root,
    session,
    store,
    view,
    sendTerminalInput: (data: string) => inputListener?.(data),
  };
};

const editorValue = (host: HTMLElement) =>
  host.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="コードエディタ"]',
  )!.value;

const action = (host: HTMLElement, name: string) =>
  host.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);

const clickAction = async (host: HTMLElement, name: string) => {
  await act(async () => {
    action(host, name)?.click();
  });
  await settle();
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
  await settle();
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
    sendTerminalInput("pnpm exercise:01\r");
    await act(async () => undefined);

    expect(session.writeInput).not.toHaveBeenCalled();

    await act(async () => write.resolve());

    expect(session.writeInput).toHaveBeenCalledWith("pnpm exercise:01\r");
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
    sendTerminalInput("pnpm exercise:01\r");
    await act(async () => undefined);

    expect(session.writeInput).not.toHaveBeenCalled();

    await act(async () => resetWrite.resolve());

    expect(session.writeInput).toHaveBeenCalledWith("pnpm exercise:01\r");
  });

  it("does not rerun stale contents when editor synchronization fails", async () => {
    const write = deferred();
    const { host, session, sendTerminalInput } = await createHarness();
    vi.mocked(session.writeFile).mockReturnValueOnce(write.promise);

    await editCurrentFile(host, "export const value = 2;");
    sendTerminalInput("pnpm exercise:01\r");
    await act(async () => write.reject(new Error("sync failed")));

    expect(session.writeInput).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("sync failed");
  });

  it("does not show a synchronization error from a session that is no longer current", async () => {
    const startGate = deferred();
    const firstWrite = deferred();
    const secondWrite = deferred();
    let started: TerminalSession | undefined;
    const { host, session } = await createHarness({
      start: false,
      startSession: async () => {
        await startGate.promise;
        return started!;
      },
    });
    started = session;
    vi.mocked(session.writeFile)
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);

    await clickAction(host, "start-terminal");
    await editCurrentFile(host, "export const value = 2;");
    await act(async () => startGate.resolve());
    await settle();
    await editCurrentFile(host, "export const value = 3;");
    await clickAction(host, "cancel-terminal");
    await act(async () => firstWrite.resolve());
    await act(async () => secondWrite.reject(new Error("disposed")));
    await settle();

    expect(session.dispose).toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("hands each edit to the session at once without waiting for the previous write", async () => {
    const firstWrite = deferred();
    const { host, session } = await createHarness();
    vi.mocked(session.writeFile).mockReturnValueOnce(firstWrite.promise);

    await editCurrentFile(host, "export const value = 2;");
    await editCurrentFile(host, "export const value = 3;");

    expect(session.writeFile).toHaveBeenCalledTimes(2);
    expect(session.writeFile).toHaveBeenNthCalledWith(
      1,
      "src/example.ts",
      "export const value = 2;",
    );
    expect(session.writeFile).toHaveBeenNthCalledWith(
      2,
      "src/example.ts",
      "export const value = 3;",
    );
    await act(async () => firstWrite.resolve());
  });

  describe("saved edits", () => {
    const edited = "export const value = 2;";

    it("restores saved edits when the page is opened again", async () => {
      const store = createMemoryStore();
      const first = await createHarness({ store, start: false });
      await editCurrentFile(first.host, edited);
      await act(async () => first.root.unmount());
      roots.splice(roots.indexOf(first.root), 1);

      const second = await createHarness({ store, start: false });

      expect(editorValue(second.host)).toBe(edited);
    });

    it("does not raise the revision just by opening a saved workspace", async () => {
      const store = createMemoryStore();
      store.seed(savedWorkspace(exampleEdit(edited), 3));

      const { host } = await createHarness({ store, start: false });

      expect(editorValue(host)).toBe(edited);
      expect(store.saveEdits).not.toHaveBeenCalled();
      expect(store.revisionOf(workspace.slug)).toBe(3);
    });

    it("keeps the editor and terminal start locked until saved edits are read", async () => {
      const store = createMemoryStore();
      let finishLoad!: () => void;
      store.load.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishLoad = () => resolve({});
          }),
      );

      const { host } = await createHarness({ store, start: false });

      expect(
        host.querySelector<HTMLTextAreaElement>("textarea")?.disabled,
      ).toBe(true);
      expect(action(host, "start-terminal")?.disabled).toBe(true);

      await act(async () => finishLoad());
      await settle();

      expect(
        host.querySelector<HTMLTextAreaElement>("textarea")?.disabled,
      ).toBe(false);
      expect(action(host, "start-terminal")?.disabled).toBe(false);
    });

    it("offers a retry when saving fails and saves again on retry", async () => {
      const store = createMemoryStore();
      const { host } = await createHarness({ store, start: false });
      store.saveEdits.mockRejectedValueOnce(new Error("quota"));

      await editCurrentFile(host, edited);

      expect(action(host, "retry-save")).not.toBeNull();

      await clickAction(host, "retry-save");

      expect(action(host, "retry-save")).toBeNull();
      expect(store.saveEdits).toHaveBeenCalledTimes(2);
      expect(store.editsOf(workspace.slug)).toEqual(exampleEdit(edited));
    });

    it("tells the participant when edits were saved before but are gone", async () => {
      vi.stubGlobal("localStorage", {
        getItem: (key: string) =>
          key === `code-explorer:has-saved-edits:${workspace.slug}` ? "1" : null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });
      const store = createMemoryStore();

      const { host } = await createHarness({ store, start: false });

      expect(host.querySelector('[role="alert"]')).not.toBeNull();
      expect(editorValue(host)).toBe(files["src/example.ts"]);
      expect(store.saveEdits).not.toHaveBeenCalled();

      await editCurrentFile(host, edited);

      expect(host.querySelector('[role="alert"]')).toBeNull();
      expect(store.editsOf(workspace.slug)).toEqual(exampleEdit(edited));
    });

    it("never saves after reading the saved edits failed", async () => {
      const store = createMemoryStore();
      store.load.mockRejectedValueOnce(new Error("blocked"));
      const { host } = await createHarness({ store, start: false });

      await editCurrentFile(host, edited);

      expect(host.querySelector('[role="alert"]')).not.toBeNull();
      expect(store.saveEdits).not.toHaveBeenCalled();
    });

    describe("when the lesson changed since the edits were saved", () => {
      const outdated = savedWorkspace(
        exampleEdit(edited, "export const value = 0;"),
      );

      it("uses the saved edits and renews their base", async () => {
        const store = createMemoryStore();
        store.seed(outdated);
        const { host } = await createHarness({ store, start: false });

        expect(editorValue(host)).toBe(files["src/example.ts"]);
        expect(action(host, "use-saved-edits")).not.toBeNull();

        await clickAction(host, "use-saved-edits");

        expect(editorValue(host)).toBe(edited);
        expect(action(host, "use-saved-edits")).toBeNull();
        expect(store.editsOf(workspace.slug)).toEqual(exampleEdit(edited));
      });

      it("starts from the updated code and drops the old edits", async () => {
        const store = createMemoryStore();
        store.seed(outdated);
        const { host } = await createHarness({ store, start: false });

        await clickAction(host, "use-updated-code");

        expect(editorValue(host)).toBe(files["src/example.ts"]);
        expect(action(host, "use-updated-code")).toBeNull();
        expect(store.editsOf(workspace.slug)).toEqual({});
      });

      it("keeps the terminal start locked until a choice is made", async () => {
        const store = createMemoryStore();
        store.seed(outdated);
        const { host } = await createHarness({ store, start: false });

        expect(action(host, "start-terminal")?.disabled).toBe(true);

        await clickAction(host, "use-updated-code");

        expect(action(host, "start-terminal")?.disabled).toBe(false);
      });
    });

    describe("when another tab saves", () => {
      const other = "export const value = 3;";

      it("follows the other tab when there are no unsaved edits", async () => {
        const store = createMemoryStore();
        const { host, session } = await createHarness({ store });

        await act(async () => {
          store.writeAsOtherTab(workspace.slug, exampleEdit(other), true);
        });
        await settle();

        expect(editorValue(host)).toBe(other);
        expect(action(host, "load-other-tab")).toBeNull();
        expect(session.writeFile).toHaveBeenCalledWith("src/example.ts", other);
      });

      it("asks which edits to keep when this tab has unsaved edits", async () => {
        const store = createMemoryStore();
        const { host } = await createHarness({ store, start: false });
        store.saveEdits.mockRejectedValueOnce(new Error("quota"));
        await editCurrentFile(host, edited);

        await act(async () => {
          store.writeAsOtherTab(workspace.slug, exampleEdit(other), true);
        });
        await settle();

        expect(action(host, "load-other-tab")).not.toBeNull();
        expect(action(host, "overwrite-other-tab")).not.toBeNull();
        expect(editorValue(host)).toBe(edited);
      });

      it("loads the other tab's edits when asked", async () => {
        const store = createMemoryStore();
        const { host, session } = await createHarness({ store });
        store.writeAsOtherTab(workspace.slug, exampleEdit(other), false);
        await editCurrentFile(host, edited);
        expect(action(host, "load-other-tab")).not.toBeNull();

        await clickAction(host, "load-other-tab");

        expect(editorValue(host)).toBe(other);
        expect(action(host, "load-other-tab")).toBeNull();
        expect(session.writeFile).toHaveBeenLastCalledWith(
          "src/example.ts",
          other,
        );
        expect(store.editsOf(workspace.slug)).toEqual(exampleEdit(other));
      });

      it("overwrites the other tab's edits when asked", async () => {
        const store = createMemoryStore();
        const { host } = await createHarness({ store, start: false });
        store.writeAsOtherTab(workspace.slug, exampleEdit(other), false);
        await editCurrentFile(host, edited);
        expect(action(host, "overwrite-other-tab")).not.toBeNull();

        await clickAction(host, "overwrite-other-tab");

        expect(editorValue(host)).toBe(edited);
        expect(action(host, "overwrite-other-tab")).toBeNull();
        expect(store.editsOf(workspace.slug)).toEqual(exampleEdit(edited));
        expect(store.revisionOf(workspace.slug)).toBe(2);
      });
    });
  });

  describe("edits made while the terminal is preparing", () => {
    it("reaches the container before the initial command runs", async () => {
      let finishStart!: () => void;
      const gate = new Promise<void>((resolve) => {
        finishStart = resolve;
      });
      const session: TerminalSession = {
        writeInput: vi.fn(async () => undefined),
        writeFile: vi.fn(async () => undefined),
        resize: vi.fn(),
        restartShell: vi.fn(async () => undefined),
        dispose: vi.fn(async () => undefined),
      };
      const { host } = await createHarness({
        initialCommand: "pnpm exercise:02",
        startSession: async () => {
          await gate;
          return session;
        },
      });

      await editCurrentFile(host, "export const value = 2;");
      await act(async () => finishStart());
      await settle();

      expect(session.writeFile).toHaveBeenCalledWith(
        "src/example.ts",
        "export const value = 2;",
      );
      expect(session.writeInput).toHaveBeenCalledWith("pnpm exercise:02\r");
      expect(
        vi.mocked(session.writeFile).mock.invocationCallOrder[0],
      ).toBeLessThan(
        vi.mocked(session.writeInput).mock.invocationCallOrder[0]!,
      );
    });
  });

  describe("terminal output from the previous visit", () => {
    const previousOutput = "FAIL src/example.test.ts\r\n";
    const delimiterWrites = (view: TerminalView) =>
      vi
        .mocked(view.write)
        .mock.calls.filter(([data]) => data.includes("ここまでが前回の出力です"));

    const seedOutput = () => {
      const store = createMemoryStore();
      store.seed(savedWorkspace({}, 1), {
        slug: workspace.slug,
        output: previousOutput,
        lastOutputAt: 2000,
      });
      return store;
    };

    it("shows the previous output before the terminal starts", async () => {
      const { view } = await createHarness({
        store: seedOutput(),
        start: false,
      });

      expect(view.write).toHaveBeenCalledWith(
        previousOutput,
        expect.any(Function),
      );
      expect(view.open).toHaveBeenCalledOnce();
    });

    it("fits the terminal to its container before writing the previous output", async () => {
      const { view } = await createHarness({
        store: seedOutput(),
        start: false,
      });

      const fitOrder = vi.mocked(view.fit).mock.invocationCallOrder[0];
      const writeOrder = vi.mocked(view.write).mock.invocationCallOrder[0];
      expect(fitOrder).toBeDefined();
      expect(fitOrder).toBeLessThan(writeOrder!);
    });

    it("does not rerun the exercise when the terminal starts", async () => {
      const { session, view } = await createHarness({
        store: seedOutput(),
        initialCommand: "pnpm exercise:02",
      });

      expect(session.writeInput).not.toHaveBeenCalled();
      expect(view.open).toHaveBeenCalledOnce();
      expect(delimiterWrites(view)).toHaveLength(1);
    });

    it("writes the delimiter once even when startup is retried", async () => {
      let attempts = 0;
      const session: TerminalSession = {
        writeInput: vi.fn(async () => undefined),
        writeFile: vi.fn(async () => undefined),
        resize: vi.fn(),
        restartShell: vi.fn(async () => undefined),
        dispose: vi.fn(async () => undefined),
      };
      const { host, view } = await createHarness({
        store: seedOutput(),
        startSession: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("boot failed");
          return session;
        },
      });

      expect(view.dispose).not.toHaveBeenCalled();
      await clickAction(host, "retry-terminal");

      expect(attempts).toBe(2);
      expect(delimiterWrites(view)).toHaveLength(1);
      expect(view.dispose).not.toHaveBeenCalled();
    });

    it("records the terminal output for the next visit once a command was sent", async () => {
      const store = seedOutput();
      const { root, sendTerminalInput } = await createHarness({ store });
      sendTerminalInput("ls\r");
      await settle();
      await act(async () => root.unmount());
      roots.splice(roots.indexOf(root), 1);

      const saved = (await store.load(workspace.slug)).view;

      expect(saved?.output.startsWith(previousOutput)).toBe(true);
      expect(saved?.output.split("ここまでが前回の出力です")).toHaveLength(2);
    });

    const visitRunner = () => {
      let request!: TerminalStartRequest;
      const session: TerminalSession = {
        writeInput: vi.fn(async () => undefined),
        writeFile: vi.fn(async () => undefined),
        resize: vi.fn(),
        restartShell: vi.fn(async () => undefined),
        dispose: vi.fn(async () => undefined),
      };
      return {
        getRequest: () => request,
        startSession: async (next: TerminalStartRequest) => {
          request = next;
          return session;
        },
      };
    };

    const visit = async (
      store: MemoryStore,
      runner: ReturnType<typeof visitRunner>,
      sendCommand: boolean,
    ) => {
      const harness = await createHarness({
        store,
        startSession: runner.startSession,
      });
      await act(async () => {
        runner.getRequest().onOutput("$ ");
      });
      if (sendCommand) {
        harness.sendTerminalInput("ls\r");
        await settle();
        await act(async () => {
          runner.getRequest().onOutput("package.json\r\n");
        });
      }
      await act(async () => harness.root.unmount());
      roots.splice(roots.indexOf(harness.root), 1);
    };

    it("keeps the saved output while the terminal is only started and closed again", async () => {
      const store = seedOutput();
      const runner = visitRunner();

      await visit(store, runner, false);
      await visit(store, runner, false);
      await visit(store, runner, false);

      expect(store.saveTerminalOutput).not.toHaveBeenCalled();
      expect(store.viewOf(workspace.slug)?.output).toBe(previousOutput);
      expect(store.viewOf(workspace.slug)?.lastOutputAt).toBe(2000);
    });

    it("adds one delimiter after the previous output when a command is sent after repeated visits", async () => {
      const store = seedOutput();
      const runner = visitRunner();

      await visit(store, runner, false);
      await visit(store, runner, false);
      await visit(store, runner, false);
      await visit(store, runner, true);

      const output = store.viewOf(workspace.slug)?.output ?? "";
      expect(output.startsWith(previousOutput)).toBe(true);
      expect(output.split("ここまでが前回の出力です")).toHaveLength(2);
      expect(output.endsWith("$ package.json\r\n")).toBe(true);
      expect(output.indexOf("ここまでが前回の出力です")).toBeLessThan(
        output.indexOf("$ package.json"),
      );
    });
  });

  describe("saving the terminal view", () => {
    const twoFiles: SessionWorkspace = {
      ...workspace,
      visibleFiles: ["src/example.ts", "package.json"],
    };

    const startRequest = () => {
      let request!: TerminalStartRequest;
      const session: TerminalSession = {
        writeInput: vi.fn(async () => undefined),
        writeFile: vi.fn(async () => undefined),
        resize: vi.fn(),
        restartShell: vi.fn(async () => undefined),
        dispose: vi.fn(async () => undefined),
      };
      return {
        getRequest: () => request,
        startSession: async (next: TerminalStartRequest) => {
          request = next;
          return session;
        },
      };
    };

    const unmount = async (root: Root) => {
      await act(async () => root.unmount());
      roots.splice(roots.indexOf(root), 1);
    };

    it("keeps the output another tab saved when this tab only switches files", async () => {
      const store = createMemoryStore();
      store.seed(savedWorkspace({}), {
        slug: workspace.slug,
        output: "old output",
        lastOutputAt: 1,
      });
      const { host, root } = await createHarness({
        store,
        start: false,
        workspace: twoFiles,
      });
      store.setView({
        slug: workspace.slug,
        output: "output from the other tab",
        lastOutputAt: 5000,
      });

      await act(async () => {
        host.querySelector<HTMLButtonElement>('[data-path="package.json"]')?.click();
      });
      await act(async () => {
        window.dispatchEvent(new Event("pagehide"));
      });
      await settle();
      await unmount(root);

      expect(store.saveTerminalOutput).not.toHaveBeenCalled();
      expect(store.viewOf(workspace.slug)).toEqual({
        slug: workspace.slug,
        output: "output from the other tab",
        lastOutputAt: 5000,
        selectedPath: "package.json",
      });
    });

    it("does not touch the saved output when this tab produced none", async () => {
      const store = createMemoryStore();
      const { root } = await createHarness({ store, start: false });

      await unmount(root);

      expect(store.saveTerminalOutput).not.toHaveBeenCalled();
      expect(store.saveSelectedPath).not.toHaveBeenCalled();
    });

    it("advances the last output time only after a command was sent", async () => {
      const store = createMemoryStore();
      const runner = startRequest();
      const { root } = await createHarness({
        store,
        startSession: runner.startSession,
      });

      await act(async () => {
        runner.getRequest().onOutput("$ ");
      });
      await unmount(root);

      expect(store.saveTerminalOutput).not.toHaveBeenCalled();
      expect(store.viewOf(workspace.slug)?.output ?? "").toBe("");
      expect(store.viewOf(workspace.slug)?.lastOutputAt ?? 0).toBe(0);

      const second = await createHarness({
        store,
        startSession: runner.startSession,
      });
      await act(async () => {
        runner.getRequest().onOutput("$ ");
      });
      second.sendTerminalInput("ls\r");
      await settle();
      await act(async () => {
        runner.getRequest().onOutput("package.json\r\n");
      });
      await unmount(second.root);

      expect(store.viewOf(workspace.slug)?.output).toBe("$ package.json\r\n");
      expect(store.viewOf(workspace.slug)?.lastOutputAt).toBeGreaterThan(0);
    });

    it("asks before leaving when reading failed and edits were made", async () => {
      const store = createMemoryStore();
      store.load.mockRejectedValueOnce(new Error("blocked"));
      const { host } = await createHarness({ store, start: false });
      const unedited = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(unedited);
      expect(unedited.defaultPrevented).toBe(false);

      await editCurrentFile(host, "export const value = 2;");
      const edited = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(edited);

      expect(edited.defaultPrevented).toBe(true);
    });
  });
});
