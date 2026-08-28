import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TerminalRunner,
  TerminalSession,
  TerminalStartRequest,
} from "../../code-explorer/runner";
import type { CodeGuide } from "../../code-explorer/code-guide";
import type { EditorProps } from "./CodeExplorer";
import { CodeExplorer } from "./CodeExplorer";
import type { TerminalView } from "./TerminalPanel";

const TestEditor: ComponentType<EditorProps> = ({
  path,
  value,
  typeFiles,
  disabled,
  readOnly,
  highlights,
  onChange,
}) => (
  <textarea
    aria-label="コードエディタ"
    data-path={path}
    data-highlights={highlights
      .map(
        ({ startLineNumber, endLineNumber }) =>
          `${startLineNumber}:${endLineNumber}`,
      )
      .join(",")}
    data-type-file={typeFiles["file:///node_modules/vitest/index.d.ts"]}
    value={value}
    disabled={disabled}
    readOnly={readOnly}
    onChange={(event) => onChange(event.currentTarget.value)}
  />
);

const workspace = {
  slug: "01-state-modeling",
  snapshot: "session-01",
  description: "状態を編集します。",
  initialFile: "exercises/example.test.ts",
  visibleFiles: ["exercises/example.test.ts", "src/example.ts"],
} as const;

const files = {
  "exercises/example.test.ts": "expect(value).toBe(1);",
  "src/example.ts": "export const value = 1;",
  "package.json": "{}",
} as const;

const guides = [
  {
    id: "string-status",
    title: "状態を任意の文字列で表している",
    currentDesign: "status と newStatus は string です。",
    futureRisk: "許可する状態と遷移を型から判断できません。",
    path: "src/example.ts",
    highlights: [{ startLineNumber: 1, endLineNumber: 1 }],
  },
  {
    id: "throw-error",
    title: "予期可能な失敗を throw している",
    currentDesign: "見つからない場合に例外を送出します。",
    futureRisk: "呼び出し側が失敗の種類を型から判断できません。",
    path: "exercises/example.test.ts",
    highlights: [{ startLineNumber: 1, endLineNumber: 1 }],
  },
] as const satisfies readonly CodeGuide[];

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

const renderExplorer = async (
  props: Partial<React.ComponentProps<typeof CodeExplorer>> = {},
) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);

  await act(async () =>
    root.render(
      <CodeExplorer
        workspace={workspace}
        projectFiles={files}
        Editor={TestEditor}
        supportsRuntime={() => true}
        loadTerminalView={async () => createView()}
        {...props}
      />,
    ),
  );

  return host;
};

const selectFile = async (host: HTMLElement, path: string) => {
  await act(async () =>
    host.querySelector<HTMLButtonElement>(`[data-path="${path}"]`)?.click(),
  );
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

const clickAction = async (host: HTMLElement, action: string) => {
  await act(async () => {
    host
      .querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
      ?.click();
  });
};

describe("CodeExplorer", () => {
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

  it("uses guides without mutable controls or a terminal", async () => {
    const runnerFactory = vi.fn<() => TerminalRunner>();
    const host = await renderExplorer({ guides, runnerFactory });
    const second = host.querySelector<HTMLButtonElement>(
      '[data-code-guide="throw-error"]',
    )!;

    expect(host.querySelector("textarea")?.readOnly).toBe(true);
    expect(host.querySelector("textarea")?.dataset.path).toBe("src/example.ts");
    expect(host.querySelector("textarea")?.dataset.highlights).toBe("1:1");
    expect(host.querySelector('[data-action="reset"]')).toBeNull();
    expect(host.querySelector('[data-action="start-terminal"]')).toBeNull();

    await act(async () => second.click());
    expect(host.querySelector("textarea")?.dataset.path).toBe(
      "exercises/example.test.ts",
    );
    expect(runnerFactory).not.toHaveBeenCalled();
  });

  it("keeps edits across file switches and resets only the selected file", async () => {
    const host = await renderExplorer();

    await selectFile(host, "src/example.ts");
    await editCurrentFile(host, "export const value = 2;");
    await selectFile(host, "exercises/example.test.ts");
    await editCurrentFile(host, "expect(value).toBe(2);");
    await selectFile(host, "src/example.ts");

    expect(host.querySelector("textarea")?.value).toBe(
      "export const value = 2;",
    );
    expect(
      host.querySelector('[data-path="src/example.ts"]')?.textContent,
    ).toContain("変更あり");
    await clickAction(host, "reset");
    expect(host.querySelector("textarea")?.value).toBe(
      "export const value = 1;",
    );

    await selectFile(host, "exercises/example.test.ts");
    expect(host.querySelector("textarea")?.value).toBe(
      "expect(value).toBe(2);",
    );
  });

  it("removes fixed execution controls and starts a terminal with current edits", async () => {
    const session = createSession();
    let request: TerminalStartRequest | undefined;
    const runner: TerminalRunner = {
      start: async (nextRequest) => {
        request = nextRequest;
        nextRequest.onTypeFiles({
          "file:///node_modules/vitest/index.d.ts": "expect types",
        });
        return session;
      },
    };
    const host = await renderExplorer({ runnerFactory: () => runner });

    expect(host.querySelector('[data-action="run"]')).toBeNull();
    expect(host.querySelector('[data-action="stop"]')).toBeNull();
    expect(host.querySelector('[aria-label="実行結果"]')).toBeNull();

    await editCurrentFile(host, "expect(value).toBe(2);");
    await selectFile(host, "src/example.ts");
    await editCurrentFile(host, "export const value = 2;");
    await clickAction(host, "start-terminal");

    expect(request?.files).toEqual({
      "exercises/example.test.ts": "expect(value).toBe(2);",
      "src/example.ts": "export const value = 2;",
      "package.json": "{}",
    });
    expect(request?.visibleFiles).toEqual([
      "exercises/example.test.ts",
      "src/example.ts",
    ]);
    expect(host.querySelector("textarea")?.dataset.typeFile).toBe(
      "expect types",
    );
  });

  it("writes editor changes and resets to a running terminal session", async () => {
    const session = createSession();
    const host = await renderExplorer({
      runnerFactory: () => ({ start: async () => session }),
    });
    await clickAction(host, "start-terminal");

    await selectFile(host, "src/example.ts");
    await editCurrentFile(host, "export const value = 3;");
    expect(session.writeFile).toHaveBeenCalledWith(
      "src/example.ts",
      "export const value = 3;",
    );

    await clickAction(host, "reset");
    expect(session.writeFile).toHaveBeenLastCalledWith(
      "src/example.ts",
      "export const value = 1;",
    );
  });

  it("adds, updates, and deletes terminal-created text files", async () => {
    const session = createSession();
    let request: TerminalStartRequest | undefined;
    const host = await renderExplorer({
      runnerFactory: () => ({
        start: async (nextRequest) => {
          request = nextRequest;
          return session;
        },
      }),
    });
    await clickAction(host, "start-terminal");

    await act(async () =>
      request?.onWorkspaceChange({
        kind: "write",
        path: "src/created.ts",
        contents: "export const created = true;",
      }),
    );
    const createdButton = host.querySelector<HTMLButtonElement>(
      '[data-path="src/created.ts"]',
    );
    expect(createdButton).not.toBeNull();

    await selectFile(host, "src/created.ts");
    expect(host.querySelector("textarea")?.value).toBe(
      "export const created = true;",
    );
    expect(
      host.querySelector<HTMLButtonElement>('[data-action="reset"]')?.disabled,
    ).toBe(true);

    await act(async () =>
      request?.onWorkspaceChange({
        kind: "write",
        path: "src/created.ts",
        contents: "export const created = false;",
      }),
    );
    expect(host.querySelector("textarea")?.value).toBe(
      "export const created = false;",
    );

    await act(async () =>
      request?.onWorkspaceChange({ kind: "delete", path: "src/created.ts" }),
    );
    expect(host.querySelector('[data-path="src/created.ts"]')).toBeNull();
    expect(host.querySelector("textarea")?.dataset.path).toBe(
      "exercises/example.test.ts",
    );
  });

  it("disables editing only while the terminal is preparing", async () => {
    const session = createSession();
    let resolveStart!: (session: TerminalSession) => void;
    const start = new Promise<TerminalSession>((resolve) => {
      resolveStart = resolve;
    });
    const host = await renderExplorer({
      runnerFactory: () => ({ start: async () => start }),
    });

    act(() =>
      host
        .querySelector<HTMLButtonElement>('[data-action="start-terminal"]')
        ?.click(),
    );
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(
      true,
    );
    expect(
      host.querySelector<HTMLButtonElement>('[data-action="reset"]')?.disabled,
    ).toBe(true);
    expect(
      [...host.querySelectorAll<HTMLButtonElement>("[data-path]")].every(
        (button) => button.disabled,
      ),
    ).toBe(true);

    await act(async () => resolveStart(session));
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(
      false,
    );
    expect(
      host.querySelector<HTMLButtonElement>('[data-action="reset"]')?.disabled,
    ).toBe(false);
  });

  it("keeps nested folders and duplicate file names distinguishable", async () => {
    const duplicateWorkspace = {
      ...workspace,
      initialFile: "exercises/01-state-modeling.test.ts",
      visibleFiles: [
        "exercises/01-state-modeling.test.ts",
        "test/01-state-modeling.test.ts",
      ],
    } as const;
    const host = await renderExplorer({
      workspace: duplicateWorkspace,
      projectFiles: {
        "exercises/01-state-modeling.test.ts": "exercise",
        "test/01-state-modeling.test.ts": "solution",
      },
    });
    const exerciseButton = host.querySelector<HTMLButtonElement>(
      '[data-path="exercises/01-state-modeling.test.ts"]',
    )!;
    const solutionButton = host.querySelector<HTMLButtonElement>(
      '[data-path="test/01-state-modeling.test.ts"]',
    )!;

    expect(exerciseButton.textContent).toBe("01-state-modeling.test.ts");
    expect(solutionButton.textContent).toBe("01-state-modeling.test.ts");
    expect(exerciseButton.getAttribute("aria-label")).toBe(
      "exercises/01-state-modeling.test.ts",
    );
    expect(solutionButton.getAttribute("aria-label")).toBe(
      "test/01-state-modeling.test.ts",
    );
    for (const label of host.querySelectorAll<HTMLElement>(
      ".code-explorer__folder",
    )) {
      expect(label.id.length).toBeGreaterThan(0);
      expect(label.nextElementSibling?.getAttribute("aria-labelledby")).toBe(
        label.id,
      );
    }
  });
});
