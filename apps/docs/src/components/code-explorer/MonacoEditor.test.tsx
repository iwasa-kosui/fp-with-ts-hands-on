import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonacoEditor } from "./MonacoEditor";

const monacoState = vi.hoisted(() => {
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

  const models = new Map<string, FakeModel>();
  let currentModel: FakeModel | null = null;
  const editor = {
    getModel: vi.fn(() => currentModel),
    setModel: vi.fn((model: FakeModel | null) => {
      currentModel = model;
    }),
    getValue: vi.fn(() => currentModel?.getValue() ?? ""),
    createDecorationsCollection: vi.fn(() => ({ clear: vi.fn() })),
    revealRangeInCenter: vi.fn(),
    updateOptions: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    monaco: {
      Range: class {},
      Uri: { parse: (uri: string) => uri },
      editor: {
        getModel: (uri: string) => models.get(uri) ?? null,
        createModel: (source: string, _language: string, uri: string) => {
          const model = new FakeModel(source);
          models.set(uri, model);
          return model;
        },
        create: (_host: HTMLElement, options: { model: FakeModel | null }) => {
          currentModel = options.model;
          return editor;
        },
      },
      typescript: {
        ModuleKind: { ESNext: 99 },
        ModuleResolutionKind: { NodeJs: 2 },
        ScriptTarget: { ES2020: 7 },
        typescriptDefaults: {
          setCompilerOptions: vi.fn(),
          addExtraLib: vi.fn(() => ({ dispose: vi.fn() })),
        },
      },
    },
    modelFor: (path: string) => models.get(`file:///${path}`),
    reset: () => {
      models.clear();
      currentModel = null;
    },
  };
});

vi.mock("./monaco-client", () => ({ monaco: monacoState.monaco }));

const projectFiles = {
  "src/first.ts": "const first = true;",
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
    rerender: async (nextProps: ComponentProps<typeof MonacoEditor>) => {
      await act(async () => root.render(<MonacoEditor {...nextProps} />));
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

  it("disposes a projected model after its file is removed", async () => {
    const initialProps: ComponentProps<typeof MonacoEditor> = {
      path: "src/first.ts",
      value: projectFiles["src/first.ts"],
      files: projectFiles,
      typeFiles: {},
      disabled: false,
      readOnly: false,
      highlights: [],
      onChange: () => undefined,
    };
    const mounted = await renderHydratedEditor(initialProps);
    const projectedFiles = { ...projectFiles, "README.md": "# Notes" };

    await mounted.rerender({
      ...initialProps,
      path: "README.md",
      value: projectedFiles["README.md"],
      files: projectedFiles,
    });

    const removedModel = monacoState.modelFor("README.md")!;
    await mounted.rerender(initialProps);

    expect(removedModel.dispose).toHaveBeenCalledOnce();
  });
});
