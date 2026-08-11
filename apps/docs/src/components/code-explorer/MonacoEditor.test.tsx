import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonacoEditor, modelUriFor } from "./MonacoEditor";

const monacoState = vi.hoisted(() => {
  class FakeRange {
    constructor(
      readonly startLineNumber: number,
      readonly startColumn: number,
      readonly endLineNumber: number,
      readonly endColumn: number,
    ) {}
  }

  class FakeModel {
    readonly dispose = vi.fn();
    readonly onDidChangeContent = vi.fn(() => ({ dispose: vi.fn() }));

    constructor(private value: string) {}

    getValue(): string {
      return this.value;
    }

    setValue(value: string): void {
      this.value = value;
    }

    getLineMaxColumn(lineNumber: number): number {
      return (this.value.split("\n")[lineNumber - 1]?.length ?? 0) + 1;
    }
  }

  type FakeDecoration = Readonly<{
    range: FakeRange;
    options: Readonly<{
      isWholeLine: boolean;
      className: string;
      linesDecorationsClassName: string;
    }>;
  }>;

  const models = new Map<string, FakeModel>();
  const decorationCollections: Array<{
    decorations: readonly FakeDecoration[];
    clear: ReturnType<typeof vi.fn>;
  }> = [];
  let currentModel: FakeModel | null = null;

  const editor = {
    getModel: vi.fn(() => currentModel),
    setModel: vi.fn((model: FakeModel | null) => {
      currentModel = model;
    }),
    getValue: vi.fn(() => currentModel?.getValue() ?? ""),
    createDecorationsCollection: vi.fn(
      (decorations: readonly FakeDecoration[]) => {
        const collection = { decorations, clear: vi.fn() };
        decorationCollections.push(collection);
        return collection;
      },
    ),
    revealRangeInCenter: vi.fn(),
    updateOptions: vi.fn(),
    dispose: vi.fn(),
  };
  const createEditor = vi.fn(
    (
      _host: HTMLElement,
      options: Readonly<{
        automaticLayout: boolean;
        model: FakeModel | null;
        readOnly: boolean;
      }>,
    ) => {
      currentModel = options.model;
      return editor;
    },
  );
  const setCompilerOptions = vi.fn();
  const addExtraLib = vi.fn(() => ({ dispose: vi.fn() }));

  return {
    monaco: {
      Range: FakeRange,
      Uri: { parse: (uri: string) => uri },
      editor: {
        getModel: (uri: string) => models.get(uri) ?? null,
        createModel: (source: string, _language: string, uri: string) => {
          const model = new FakeModel(source);
          models.set(uri, model);
          return model;
        },
        create: createEditor,
      },
      typescript: {
        ModuleKind: { ESNext: 99 },
        ModuleResolutionKind: { NodeJs: 2 },
        ScriptTarget: { ES2020: 7 },
        typescriptDefaults: { setCompilerOptions, addExtraLib },
      },
    },
    editor,
    createEditor,
    decorationCollections,
    modelFor: (path: string) => models.get(`file:///${path}`),
    reset: () => {
      models.clear();
      decorationCollections.splice(0);
      currentModel = null;
    },
  };
});

vi.mock("./monaco-client", () => ({ monaco: monacoState.monaco }));

const projectFiles = {
  "src/first.ts":
    "const first = true;\nconst status = 'scheduled';\nconst end = true;",
  "src/second.ts": "const second = true;",
} as const;

const roots: Root[] = [];

const renderHydratedEditor = async (
  props: ComponentProps<typeof MonacoEditor>,
) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);

  await act(async () => root.render(<MonacoEditor {...props} />));
  await vi.waitFor(() => expect(host.querySelector("pre")).toBeNull());

  return {
    host,
    rerender: async (nextProps: ComponentProps<typeof MonacoEditor>) => {
      await act(async () => root.render(<MonacoEditor {...nextProps} />));
    },
    unmount: async () => {
      await act(async () => root.unmount());
      roots.splice(roots.indexOf(root), 1);
    },
  };
};

describe("MonacoEditor", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    monacoState.reset();
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots.splice(0)) root.unmount();
    });
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("renders readable source before browser hydration", () => {
    const html = renderToString(
      <MonacoEditor
        path="src/clinic/appointment.ts"
        value={'export const kind = "Scheduled";'}
        files={{
          "src/clinic/appointment.ts": 'export const kind = "Scheduled";',
        }}
        typeFiles={{}}
        disabled={false}
        readOnly={false}
        highlights={[]}
        onChange={() => undefined}
      />,
    );
    expect(html).toContain('role="region"');
    expect(html).toContain(
      'aria-label="コードエディタ: src/clinic/appointment.ts"',
    );
    expect(html).toContain('aria-label="コード: src/clinic/appointment.ts"');
    expect(html).toContain('class="code-explorer__monaco-host"');
    expect(html).toContain("src/clinic/appointment.ts");
    expect(html).toContain("export const kind");
  });

  it("marks highlighted fallback lines before browser hydration", () => {
    const html = renderToString(
      <MonacoEditor
        path="src/example.ts"
        value={'const safe = true;\nconst status: string = "scheduled";'}
        files={{
          "src/example.ts":
            'const safe = true;\nconst status: string = "scheduled";',
        }}
        typeFiles={{}}
        disabled={false}
        readOnly={true}
        highlights={[{ startLineNumber: 2, endLineNumber: 2 }]}
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('data-line="2"');
    expect(html).toContain("code-explorer__source-line--highlighted");
    expect(html).toContain("const status: string");
  });

  it("uses absolute file URIs for project-relative paths", () => {
    expect(modelUriFor("src/clinic/appointment.ts")).toBe(
      "file:///src/clinic/appointment.ts",
    );
  });

  it("initializes a read-only editor with one highlighted range in view", async () => {
    await renderHydratedEditor({
      path: "src/first.ts",
      value: projectFiles["src/first.ts"],
      files: projectFiles,
      typeFiles: {},
      disabled: false,
      readOnly: true,
      highlights: [{ startLineNumber: 2, endLineNumber: 3 }],
      onChange: () => undefined,
    });

    const firstModel = monacoState.modelFor("src/first.ts");
    expect(monacoState.createEditor).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ model: firstModel, readOnly: true }),
    );
    expect(monacoState.decorationCollections).toHaveLength(1);
    expect(monacoState.decorationCollections[0]?.decorations).toEqual([
      {
        range: expect.objectContaining({
          startLineNumber: 2,
          startColumn: 1,
          endLineNumber: 3,
          endColumn: 18,
        }),
        options: {
          isWholeLine: true,
          className: "code-explorer__highlighted-line",
          linesDecorationsClassName: "code-explorer__highlighted-gutter",
        },
      },
    ]);
    expect(monacoState.editor.revealRangeInCenter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 3,
        endColumn: 1,
      }),
    );
  });

  it("replaces guide decorations across highlight updates and model switches", async () => {
    const firstProps: ComponentProps<typeof MonacoEditor> = {
      path: "src/first.ts",
      value: projectFiles["src/first.ts"],
      files: projectFiles,
      typeFiles: {},
      disabled: false,
      readOnly: true,
      highlights: [{ startLineNumber: 2, endLineNumber: 2 }],
      onChange: () => undefined,
    };
    const mounted = await renderHydratedEditor(firstProps);
    const previousDecorations = monacoState.decorationCollections.at(-1)!;

    await mounted.rerender({
      ...firstProps,
      highlights: [{ startLineNumber: 3, endLineNumber: 3 }],
    });

    expect(previousDecorations.clear).toHaveBeenCalledTimes(1);
    const updatedDecorations = monacoState.decorationCollections.at(-1)!;
    expect(updatedDecorations).not.toBe(previousDecorations);
    expect(updatedDecorations.decorations).toEqual([
      expect.objectContaining({
        range: expect.objectContaining({
          startLineNumber: 3,
          endLineNumber: 3,
          endColumn: 18,
        }),
      }),
    ]);
    expect(monacoState.editor.revealRangeInCenter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startLineNumber: 3,
        endLineNumber: 3,
      }),
    );

    await mounted.rerender({
      ...firstProps,
      path: "src/second.ts",
      value: projectFiles["src/second.ts"],
      readOnly: false,
      highlights: [{ startLineNumber: 1, endLineNumber: 1 }],
    });

    const secondModel = monacoState.modelFor("src/second.ts");
    expect(monacoState.editor.setModel).toHaveBeenLastCalledWith(secondModel);
    expect(monacoState.editor.getModel()).toBe(secondModel);
    expect(monacoState.editor.updateOptions).toHaveBeenLastCalledWith({
      readOnly: false,
    });
    expect(updatedDecorations.clear).toHaveBeenCalledTimes(1);

    const currentDecorations = monacoState.decorationCollections.at(-1)!;
    expect(currentDecorations).not.toBe(updatedDecorations);
    expect(currentDecorations.decorations).toEqual([
      expect.objectContaining({
        range: expect.objectContaining({
          startLineNumber: 1,
          endLineNumber: 1,
          endColumn: 21,
        }),
      }),
    ]);
    expect(monacoState.editor.revealRangeInCenter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startLineNumber: 1,
        endLineNumber: 1,
      }),
    );

    await mounted.unmount();

    expect(currentDecorations.clear).toHaveBeenCalledTimes(1);
  });
});
