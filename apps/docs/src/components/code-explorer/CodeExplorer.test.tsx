import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CodeRunner } from "../../code-explorer/runner";
import type { CodeGuide } from "../../code-explorer/code-guide";
import type { EditorProps } from "./CodeExplorer";
import { CodeExplorer } from "./CodeExplorer";

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

describe("CodeExplorer", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));

  afterEach(async () => {
    await act(async () => {
      for (const root of roots.splice(0)) root.unmount();
    });
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("uses guides to open highlighted source without mutable controls", async () => {
    const runnerFactory = vi.fn<() => CodeRunner>();
    const host = await renderExplorer({ guides, runnerFactory });

    const first = host.querySelector<HTMLButtonElement>(
      '[data-code-guide="string-status"]',
    )!;
    const second = host.querySelector<HTMLButtonElement>(
      '[data-code-guide="throw-error"]',
    )!;

    expect(first.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector("textarea")?.readOnly).toBe(true);
    expect(host.querySelector("textarea")?.dataset.path).toBe("src/example.ts");
    expect(host.querySelector("textarea")?.dataset.highlights).toBe("1:1");
    expect(host.querySelector('[data-action="reset"]')).toBeNull();
    expect(host.querySelector('[data-action="run"]')).toBeNull();
    expect(host.querySelector('[aria-label="実行結果"]')).toBeNull();

    await act(async () => second.click());

    expect(second.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector("textarea")?.dataset.path).toBe(
      "exercises/example.test.ts",
    );
    expect(host.textContent).toContain(
      "呼び出し側が失敗の種類を型から判断できません。",
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
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[data-action="reset"]')?.click(),
    );
    expect(host.querySelector("textarea")?.value).toBe(
      "export const value = 1;",
    );

    await selectFile(host, "exercises/example.test.ts");
    expect(host.querySelector("textarea")?.value).toBe(
      "expect(value).toBe(2);",
    );
  });

  it("runs the selected file with every current edit and renders streamed output", async () => {
    let receivedPath = "";
    let receivedFiles: Readonly<Record<string, string>> = {};
    const runner = {
      run: async (request, onUpdate) => {
        receivedPath = request.filePath;
        receivedFiles = request.files;
        onUpdate({ kind: "phase", phase: "running" });
        onUpdate({
          kind: "type-files",
          files: { "file:///node_modules/vitest/index.d.ts": "expect types" },
        });
        onUpdate({ kind: "output", chunk: "1 test " });
        onUpdate({ kind: "output", chunk: "passed\n" });
        return { exitCode: 0 };
      },
    } satisfies CodeRunner;
    const host = await renderExplorer({ runnerFactory: () => runner });

    await editCurrentFile(host, "expect(value).toBe(2);");
    await selectFile(host, "src/example.ts");
    await editCurrentFile(host, "export const value = 2;");
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[data-action="run"]')?.click(),
    );

    expect(receivedPath).toBe("src/example.ts");
    expect(receivedFiles).toEqual({
      "exercises/example.test.ts": "expect(value).toBe(2);",
      "src/example.ts": "export const value = 2;",
      "package.json": "{}",
    });
    expect(host.querySelector('[aria-live="polite"]')?.textContent).toContain(
      "1 test passed",
    );
    expect(host.textContent).toContain("終了コード 0");
    expect(host.querySelector("textarea")?.dataset.typeFile).toBe(
      "expect types",
    );
  });

  it("keeps the completed run path and mode after another file is selected", async () => {
    const runner = {
      run: async () => ({ exitCode: 0 }),
    } satisfies CodeRunner;
    const host = await renderExplorer({ runnerFactory: () => runner });

    await act(async () =>
      host.querySelector<HTMLButtonElement>('[data-action="run"]')?.click(),
    );
    await selectFile(host, "src/example.ts");

    const output = host.querySelector('[aria-label="実行結果"]')!;
    expect(output.textContent).toContain("exercises/example.test.ts");
    expect(output.textContent).toContain("テスト");
    expect(output.textContent).not.toContain("src/example.ts");
  });

  it("uses nested lists for folders and exposes every file as a button", async () => {
    const host = await renderExplorer();
    const navigation = host.querySelector('nav[aria-label="教材ファイル"]')!;
    const exercisesButton = navigation.querySelector<HTMLButtonElement>(
      '[data-path="exercises/example.test.ts"]',
    )!;

    expect(navigation.querySelectorAll("ul")).toHaveLength(3);
    expect(
      exercisesButton.closest("ul")?.previousElementSibling?.textContent,
    ).toBe("exercises");
    expect(exercisesButton.textContent).toContain("example.test.ts");
    expect(exercisesButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("distinguishes duplicate file names and labels nested folder lists", async () => {
    const duplicateWorkspace = {
      ...workspace,
      initialFile: "exercises/01-state-modeling.test.ts",
      visibleFiles: [
        "exercises/01-state-modeling.test.ts",
        "test/01-state-modeling.test.ts",
      ],
    } as const;
    const duplicateFiles = {
      "exercises/01-state-modeling.test.ts": "exercise",
      "test/01-state-modeling.test.ts": "solution",
    } as const;
    const host = await renderExplorer({
      workspace: duplicateWorkspace,
      projectFiles: duplicateFiles,
    });
    const exerciseButton = host.querySelector<HTMLButtonElement>(
      '[data-path="exercises/01-state-modeling.test.ts"]',
    )!;
    const solutionButton = host.querySelector<HTMLButtonElement>(
      '[data-path="test/01-state-modeling.test.ts"]',
    )!;
    const folderLabels = [
      ...host.querySelectorAll<HTMLElement>(".code-explorer__folder"),
    ];
    const initialFolderIds = folderLabels.map((label) => label.id);

    expect(exerciseButton.textContent).toBe("01-state-modeling.test.ts");
    expect(solutionButton.textContent).toBe("01-state-modeling.test.ts");
    expect(exerciseButton.getAttribute("aria-label")).toBe(
      "exercises/01-state-modeling.test.ts",
    );
    expect(solutionButton.getAttribute("aria-label")).toBe(
      "test/01-state-modeling.test.ts",
    );
    expect(initialFolderIds.every((id) => id.length > 0)).toBe(true);
    expect(new Set(initialFolderIds).size).toBe(initialFolderIds.length);
    for (const label of folderLabels) {
      expect(label.nextElementSibling?.getAttribute("aria-labelledby")).toBe(
        label.id,
      );
    }

    await editCurrentFile(host, "changed exercise");

    expect(exerciseButton.getAttribute("aria-label")).toBe(
      "exercises/01-state-modeling.test.ts、変更あり",
    );
    expect(
      [...host.querySelectorAll<HTMLElement>(".code-explorer__folder")].map(
        (label) => label.id,
      ),
    ).toEqual(initialFolderIds);
  });

  it("rejects unsupported runtimes without creating a runner", async () => {
    const runnerFactory = vi.fn<() => CodeRunner>();
    const host = await renderExplorer({
      supportsRuntime: () => false,
      runnerFactory,
    });

    await act(async () =>
      host.querySelector<HTMLButtonElement>('[data-action="run"]')?.click(),
    );

    expect(runnerFactory).not.toHaveBeenCalled();
    expect(host.textContent).toContain(
      "ChromeまたはEdgeで開き、サイトの分離ヘッダーを確認してください。",
    );
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(
      false,
    );
  });

  it("locks mutable controls while running and unlocks them after an error", async () => {
    let rejectRun!: (error: Error) => void;
    let markRunnerSettled!: () => void;
    const gate = new Promise<never>((_resolve, reject) => {
      rejectRun = reject;
    });
    const runnerSettled = new Promise<void>((resolve) => {
      markRunnerSettled = resolve;
    });
    const runner = {
      run: async (_request, onUpdate) => {
        onUpdate({ kind: "output", chunk: "partial output\n" });
        try {
          return await gate;
        } finally {
          markRunnerSettled();
        }
      },
    } satisfies CodeRunner;
    const host = await renderExplorer({ runnerFactory: () => runner });
    const runButton = host.querySelector<HTMLButtonElement>(
      '[data-action="run"]',
    )!;
    const resetButton = host.querySelector<HTMLButtonElement>(
      '[data-action="reset"]',
    )!;

    act(() => runButton.click());

    expect(runButton.disabled).toBe(true);
    expect(resetButton.disabled).toBe(true);
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(
      true,
    );
    expect(
      [...host.querySelectorAll<HTMLButtonElement>("[data-path]")].every(
        (button) => button.disabled,
      ),
    ).toBe(true);

    await act(async () => {
      rejectRun(new Error("runtime failed"));
      await runnerSettled;
    });

    expect(runButton.disabled).toBe(false);
    expect(resetButton.disabled).toBe(false);
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(
      false,
    );
    expect(host.textContent).toContain("partial output");
    expect(host.textContent).toContain("runtime failed");
  });

  it("stops a pending run and allows editing and running again", async () => {
    let runCount = 0;
    const runner = {
      run: async (request) => {
        runCount += 1;
        if (runCount === 1) {
          return new Promise<never>((_resolve, reject) => {
            request.signal?.addEventListener(
              "abort",
              () => reject(request.signal?.reason),
              { once: true },
            );
          });
        }
        return { exitCode: 0 };
      },
    } satisfies CodeRunner;
    const host = await renderExplorer({ runnerFactory: () => runner });
    const runButton = host.querySelector<HTMLButtonElement>(
      '[data-action="run"]',
    )!;

    act(() => runButton.click());

    const stopButton = host.querySelector<HTMLButtonElement>(
      '[data-action="stop"]',
    );
    expect(stopButton?.textContent).toContain("停止");
    expect(stopButton?.getAttribute("aria-label")).toBe("実行を停止");

    await act(async () => stopButton?.click());
    await vi.waitFor(() =>
      expect(
        host
          .querySelector('[aria-label="実行結果"]')
          ?.getAttribute("data-status"),
      ).toBe("canceled"),
    );

    expect(host.textContent).toContain("実行を停止しました。");
    const canceledOutput = host.querySelector('[aria-label="実行結果"]')!;
    expect(canceledOutput.textContent).toContain("exercises/example.test.ts");
    expect(canceledOutput.textContent).toContain("テスト");
    expect(runButton.disabled).toBe(false);
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(
      false,
    );

    await editCurrentFile(host, "expect(value).toBe(3);");
    await act(async () => runButton.click());

    expect(runCount).toBe(2);
    expect(host.textContent).toContain("終了コード 0");
  });

  it("treats a nonzero exit as failure and renders output as text", async () => {
    const runner = {
      run: async (_request, onUpdate) => {
        onUpdate({ kind: "output", chunk: '<img src=x onerror="alert(1)">' });
        return { exitCode: 2 };
      },
    } satisfies CodeRunner;
    const host = await renderExplorer({ runnerFactory: () => runner });

    await act(async () =>
      host.querySelector<HTMLButtonElement>('[data-action="run"]')?.click(),
    );

    const output = host.querySelector('[aria-label="実行結果"]')!;
    expect(output.getAttribute("data-status")).toBe("failure");
    expect(output.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(output.querySelector("img")).toBeNull();
    expect(output.textContent).toContain("終了コード 2");
  });
});
