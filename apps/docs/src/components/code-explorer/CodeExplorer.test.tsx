import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CodeRunner } from "../../code-explorer/runner";
import type { EditorProps } from "./CodeExplorer";
import { CodeExplorer } from "./CodeExplorer";

const TestEditor: ComponentType<EditorProps> = ({
  value,
  typeFiles,
  disabled,
  onChange,
}) => (
  <textarea
    aria-label="コードエディタ"
    data-type-file={typeFiles["file:///node_modules/vitest/index.d.ts"]}
    value={value}
    disabled={disabled}
    onChange={(event) => onChange(event.currentTarget.value)}
  />
);

const workspace = {
  slug: "01-state-modeling",
  description: "状態を編集します。",
  initialFile: "exercises/example.test.ts",
  visibleFiles: ["exercises/example.test.ts", "src/example.ts"],
} as const;

const files = {
  "exercises/example.test.ts": "expect(value).toBe(1);",
  "src/example.ts": "export const value = 1;",
  "package.json": "{}",
} as const;

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
