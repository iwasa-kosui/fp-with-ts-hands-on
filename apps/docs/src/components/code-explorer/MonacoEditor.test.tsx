import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAmbientModules } from "./ambient-modules";
import { MonacoEditor } from "./MonacoEditor";

const monacoState = vi.hoisted(() => {
  class FakeModel {
    readonly dispose = vi.fn();
    readonly onDidChangeContent = vi.fn(() => ({ dispose: vi.fn() }));

    private version = 1;

    constructor(
      private value: string,
      readonly uri: string,
    ) {}

    getValue(): string {
      return this.value;
    }

    setValue(value: string): void {
      this.value = value;
      this.version += 1;
    }

    getVersionId(): number {
      return this.version;
    }

    getLineMaxColumn(lineNumber: number): number {
      return (this.value.split("\n")[lineNumber - 1]?.length ?? 0) + 1;
    }
  }

  type FakeMarker = {
    owner: string;
    resource: string;
    severity: number;
    message: string;
    code?: string;
    startLineNumber: number;
    startColumn: number;
  };

  const models = new Map<string, FakeModel>();
  let markers: FakeMarker[] = [];
  let diagnosticsOptions: Record<string, unknown> = {};
  const markerListeners = new Set<(uris: string[]) => void>();
  let semanticGate: Promise<void> = Promise.resolve();
  let semanticCodes: number[] = [];
  let semanticFails = false;
  let currentModel: FakeModel | null = null;
  const editor = {
    getModel: vi.fn(() => currentModel),
    setModel: vi.fn((model: FakeModel | null) => {
      currentModel = model;
    }),
    getValue: vi.fn(() => currentModel?.getValue() ?? ""),
    createDecorationsCollection: vi.fn(() => ({ clear: vi.fn() })),
    revealRangeInCenter: vi.fn(),
    setPosition: vi.fn(),
    saveViewState: vi.fn(() => ({ saved: true })),
    restoreViewState: vi.fn(),
    focus: vi.fn(),
    updateOptions: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    monaco: {
      Range: class {
        constructor(
          readonly startLineNumber: number,
          readonly startColumn: number,
          readonly endLineNumber: number,
          readonly endColumn: number,
        ) {}
      },
      MarkerSeverity: { Hint: 1, Info: 2, Warning: 4, Error: 8 },
      Uri: { parse: (uri: string) => uri },
      editor: {
        getModel: (uri: string) => models.get(uri) ?? null,
        createModel: (source: string, _language: string, uri: string) => {
          const model = new FakeModel(source, uri);
          models.set(uri, model);
          return model;
        },
        getModelMarkers: ({
          owner,
          resource,
        }: {
          owner: string;
          resource: string;
        }) =>
          markers.filter(
            (marker) => marker.owner === owner && marker.resource === resource,
          ),
        onDidChangeMarkers: (listener: (uris: string[]) => void) => {
          markerListeners.add(listener);
          return { dispose: () => markerListeners.delete(listener) };
        },
        create: (_host: HTMLElement, options: { model: FakeModel | null }) => {
          currentModel = options.model;
          return editor;
        },
      },
      typescript: {
        ModuleKind: { ESNext: 99 },
        getTypeScriptWorker: async () => async () => ({
          getSemanticDiagnostics: () =>
            semanticFails
              ? Promise.reject(new Error("worker restarted"))
              : semanticGate.then(() =>
                  semanticCodes.map((code) => ({ code })),
                ),
        }),
        ScriptTarget: { ES2020: 7 },
        typescriptDefaults: {
          setCompilerOptions: vi.fn(),
          addExtraLib: vi.fn((_source: string, _path?: string) => ({
            dispose: vi.fn(),
          })),
          setEagerModelSync: vi.fn(),
          getDiagnosticsOptions: vi.fn(() => diagnosticsOptions),
          setDiagnosticsOptions: vi.fn((options: Record<string, unknown>) => {
            diagnosticsOptions = options;
          }),
        },
      },
    },
    modelFor: (path: string) => models.get(`file:///workspace/${path}`),
    setMarkers: (next: Omit<FakeMarker, "owner" | "resource">[], path: string) => {
      markers = next.map((marker) => ({
        ...marker,
        owner: "typescript",
        resource: `file:///workspace/${path}`,
      }));
    },
    holdFirstCheck: () => {
      let release: () => void = () => undefined;
      semanticGate = new Promise((resolve) => {
        release = () => resolve();
      });
      return release;
    },
    setSemanticCodes: (codes: number[]) => {
      semanticCodes = codes;
    },
    failChecks: () => {
      semanticFails = true;
    },
    emitMarkers: (path: string) => {
      for (const listener of markerListeners) {
        listener([`file:///workspace/${path}`]);
      }
    },
    reset: () => {
      models.clear();
      markers = [];
      semanticGate = Promise.resolve();
      semanticCodes = [];
      semanticFails = false;
      diagnosticsOptions = {};
      markerListeners.clear();
      currentModel = null;
    },
    editor,
  };
});

vi.mock("./monaco-client", () => ({ monaco: monacoState.monaco }));

const projectFiles = {
  "src/first.ts": "const first = true;",
  "src/second.ts": "const second = true;",
} as const;

const baseProps: ComponentProps<typeof MonacoEditor> = {
  path: "src/first.ts",
  value: projectFiles["src/first.ts"],
  files: projectFiles,
  typeFiles: {},
  disabled: false,
  readOnly: false,
  highlights: [],
  onChange: () => undefined,
};

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

  it("restores the view state after replacing the shown model from outside", async () => {
    const mounted = await renderHydratedEditor({ ...baseProps });
    const changed = "const first = false;";
    let valueAtRestore: string | undefined;
    monacoState.editor.restoreViewState.mockImplementation(() => {
      valueAtRestore = monacoState.modelFor("src/first.ts")!.getValue();
    });

    await mounted.rerender({
      ...baseProps,
      value: changed,
      files: { ...projectFiles, "src/first.ts": changed },
    });

    expect(monacoState.editor.saveViewState).toHaveBeenCalledOnce();
    expect(monacoState.editor.restoreViewState).toHaveBeenCalledOnce();
    expect(monacoState.editor.restoreViewState).toHaveBeenCalledWith({
      saved: true,
    });
    expect(valueAtRestore).toBe(changed);
  });

  it("leaves the view state alone when a model that is not shown is replaced", async () => {
    const mounted = await renderHydratedEditor({ ...baseProps });

    await mounted.rerender({
      ...baseProps,
      files: { ...projectFiles, "src/second.ts": "const second = false;" },
    });

    expect(monacoState.modelFor("src/second.ts")!.getValue()).toBe(
      "const second = false;",
    );
    expect(monacoState.editor.saveViewState).not.toHaveBeenCalled();
    expect(monacoState.editor.restoreViewState).not.toHaveBeenCalled();
  });

  it("enables validation from the start and ignores missing-type codes", async () => {
    await renderHydratedEditor({ ...baseProps });

    const { setDiagnosticsOptions } =
      monacoState.monaco.typescript.typescriptDefaults;
    expect(setDiagnosticsOptions).toHaveBeenCalledTimes(1);
    expect(setDiagnosticsOptions).toHaveBeenCalledWith({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [7006, 7031, 2580, 2591, 2582, 2593, 2347, 2694, 2709, 2698, 2571, 18046],
    });
  });

  it("clears the ignored codes after type files are registered", async () => {
    const mounted = await renderHydratedEditor({ ...baseProps });
    await mounted.rerender({
      ...baseProps,
      typeFiles: {
        "file:///workspace/node_modules/zod/index.d.ts": "export {};",
      },
    });

    const { addExtraLib, setDiagnosticsOptions } =
      monacoState.monaco.typescript.typescriptDefaults;
    expect(addExtraLib).toHaveBeenCalledWith(
      "export {};",
      "file:///workspace/node_modules/zod/index.d.ts",
    );
    expect(addExtraLib).toHaveBeenCalledWith(
      'declare module "@fp-with-ts/clinic-web";\ndeclare module "@fp-with-ts/clinic-web/*";\ndeclare module "node:*";\n',
      "file:///workspace/playground-ambient.d.ts",
    );
    expect(setDiagnosticsOptions).toHaveBeenLastCalledWith({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [],
    });
    expect(setDiagnosticsOptions).toHaveBeenCalledTimes(2);
  });

  it("lists type errors for the selected file and jumps to one", async () => {
    monacoState.setMarkers(
      [
        {
          severity: 8,
          message: "second problem",
          code: "2322",
          startLineNumber: 3,
          startColumn: 1,
        },
        {
          severity: 8,
          message: "first problem",
          code: "2304",
          startLineNumber: 1,
          startColumn: 7,
        },
        {
          severity: 2,
          message: "only a hint",
          startLineNumber: 2,
          startColumn: 1,
        },
      ],
      "src/first.ts",
    );
    const { host } = await renderHydratedEditor({ ...baseProps });

    const section = host.querySelector(
      'section[aria-label="型検査の結果"]',
    )!;
    expect(section.querySelector("h3")?.textContent).toBe("型エラー 2 件");
    const buttons = [...section.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual([
      "1:7 first problem TS2304",
      "3:1 second problem TS2322",
    ]);
    expect(section.textContent).toContain(
      "ターミナルを起動すると、外部パッケージの型を使う検査も行うので、型エラーが増えることがあります。",
    );
    expect(section.textContent).toContain(
      "演習の開始時点では、まだ実装していない部分が型エラーになります。実装すると消えます。",
    );

    await act(async () => buttons[0]!.click());

    expect(monacoState.editor.setPosition).toHaveBeenCalledWith({
      lineNumber: 1,
      column: 7,
    });
    expect(monacoState.editor.revealRangeInCenter).toHaveBeenCalledWith(
      expect.objectContaining({ startLineNumber: 1, startColumn: 7 }),
    );
    expect(monacoState.editor.focus).toHaveBeenCalledOnce();
  });

  it("shows the empty message once the markers are gone", async () => {
    monacoState.setMarkers(
      [
        {
          severity: 8,
          message: "problem",
          code: "2322",
          startLineNumber: 1,
          startColumn: 1,
        },
      ],
      "src/first.ts",
    );
    const { host } = await renderHydratedEditor({
      ...baseProps,
      typeFiles: { "node_modules/zod/index.d.ts": "export {};" },
    });
    const section = () =>
      host.querySelector('section[aria-label="型検査の結果"]')!;
    expect(section().querySelectorAll("button")).toHaveLength(1);

    monacoState.setMarkers([], "src/first.ts");
    monacoState.emitMarkers("src/first.ts");

    await vi.waitFor(() =>
      expect(section().querySelector("h3")?.textContent).toBe(
        "このファイルに型エラーは検出されていません",
      ),
    );
    expect(section().querySelectorAll("button")).toHaveLength(0);
    expect(section().textContent).not.toContain("ターミナルを起動すると");
    expect(section().textContent).not.toContain("演習の開始時点では");
  });

  it("shows a checking heading until the first check finishes", async () => {
    const release = monacoState.holdFirstCheck();
    const { host } = await renderHydratedEditor({ ...baseProps });
    const heading = () =>
      host.querySelector('section[aria-label="型検査の結果"] h3')?.textContent;

    expect(heading()).toBe("型を検査しています");

    await act(async () => release());

    await vi.waitFor(() =>
      expect(heading()).toBe("このファイルに型エラーは検出されていません"),
    );
  });

  it("returns to the checking heading when type files arrive", async () => {
    const mounted = await renderHydratedEditor({ ...baseProps });
    const heading = () =>
      mounted.host.querySelector('section[aria-label="型検査の結果"] h3')
        ?.textContent;
    await vi.waitFor(() =>
      expect(heading()).toBe("このファイルに型エラーは検出されていません"),
    );

    const release = monacoState.holdFirstCheck();
    await mounted.rerender({
      ...baseProps,
      typeFiles: { "node_modules/zod/index.d.ts": "export {};" },
    });
    expect(heading()).toBe("型を検査しています");

    await act(async () => release());

    await vi.waitFor(() =>
      expect(heading()).toBe("このファイルに型エラーは検出されていません"),
    );
  });

  it("keeps the checking heading until markers arrive for reported errors", async () => {
    monacoState.setSemanticCodes([2322]);
    const { host } = await renderHydratedEditor({
      ...baseProps,
      typeFiles: { "node_modules/zod/index.d.ts": "export {};" },
    });
    const heading = () =>
      host.querySelector('section[aria-label="型検査の結果"] h3')?.textContent;
    const seen: (string | null | undefined)[] = [];
    const observer = new MutationObserver(() => seen.push(heading()));
    observer.observe(host, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(heading()).toBe("型を検査しています");

    monacoState.setMarkers(
      [
        {
          severity: 8,
          message: "problem",
          code: "2322",
          startLineNumber: 1,
          startColumn: 1,
        },
      ],
      "src/first.ts",
    );
    monacoState.emitMarkers("src/first.ts");

    await vi.waitFor(() => expect(heading()).toBe("型エラー 1 件"));
    observer.disconnect();
    expect(seen).not.toContain("このファイルに型エラーは検出されていません");
  });

  it("goes straight to the count when markers arrive after an empty result", async () => {
    const { host } = await renderHydratedEditor({
      ...baseProps,
      typeFiles: { "node_modules/zod/index.d.ts": "export {};" },
    });
    const heading = () =>
      host.querySelector('section[aria-label="型検査の結果"] h3')?.textContent;
    const seen: (string | null | undefined)[] = [];
    const observer = new MutationObserver(() => seen.push(heading()));
    observer.observe(host, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(heading()).toBe("型を検査しています");

    monacoState.setMarkers(
      [
        {
          severity: 8,
          message: "problem",
          code: "2322",
          startLineNumber: 1,
          startColumn: 1,
        },
      ],
      "src/first.ts",
    );
    monacoState.emitMarkers("src/first.ts");

    await vi.waitFor(() => expect(heading()).toBe("型エラー 1 件"));
    observer.disconnect();
    expect(seen).not.toContain("このファイルに型エラーは検出されていません");
  });

  it("goes straight to the count when markers arrive after the worker call rejects", async () => {
    monacoState.failChecks();
    const { host } = await renderHydratedEditor({
      ...baseProps,
      typeFiles: { "node_modules/zod/index.d.ts": "export {};" },
    });
    const heading = () =>
      host.querySelector('section[aria-label="型検査の結果"] h3')?.textContent;
    const seen: (string | null | undefined)[] = [];
    const observer = new MutationObserver(() => seen.push(heading()));
    observer.observe(host, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(heading()).toBe("型を検査しています");

    monacoState.setMarkers(
      [
        {
          severity: 8,
          message: "problem",
          code: "2322",
          startLineNumber: 1,
          startColumn: 1,
        },
      ],
      "src/first.ts",
    );
    monacoState.emitMarkers("src/first.ts");

    await vi.waitFor(() => expect(heading()).toBe("型エラー 1 件"));
    observer.disconnect();
    expect(seen).not.toContain("このファイルに型エラーは検出されていません");
  });

  it("shows the count at once when markers already exist as the worker returns", async () => {
    const release = monacoState.holdFirstCheck();
    const { host } = await renderHydratedEditor({
      ...baseProps,
      typeFiles: { "node_modules/zod/index.d.ts": "export {};" },
    });
    const heading = () =>
      host.querySelector('section[aria-label="型検査の結果"] h3')?.textContent;
    const seen: (string | null | undefined)[] = [];
    const observer = new MutationObserver(() => seen.push(heading()));
    observer.observe(host, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    expect(heading()).toBe("型を検査しています");

    monacoState.setMarkers(
      [
        {
          severity: 8,
          message: "problem",
          code: "2322",
          startLineNumber: 1,
          startColumn: 1,
        },
      ],
      "src/first.ts",
    );
    monacoState.emitMarkers("src/first.ts");
    await act(async () => release());

    await vi.waitFor(() => expect(heading()).toBe("型エラー 1 件"));
    observer.disconnect();
    expect(seen).not.toContain("このファイルに型エラーは検出されていません");
  });

  it("finishes after a short wait when only ignored codes are reported", async () => {
    monacoState.setSemanticCodes([7006]);
    const { host } = await renderHydratedEditor({ ...baseProps });

    await vi.waitFor(() =>
      expect(
        host.querySelector('section[aria-label="型検査の結果"] h3')
          ?.textContent,
      ).toBe("このファイルに型エラーは検出されていません"),
    );
  });

  it("shows the explanation only while errors are listed", async () => {
    monacoState.setMarkers(
      [
        {
          severity: 8,
          message: "problem",
          code: "2322",
          startLineNumber: 1,
          startColumn: 1,
        },
      ],
      "src/first.ts",
    );
    const { host } = await renderHydratedEditor({ ...baseProps });
    const text = () =>
      host.querySelector('section[aria-label="型検査の結果"]')!.textContent;
    expect(text()).toContain("演習の開始時点では");

    monacoState.setMarkers([], "src/first.ts");
    monacoState.emitMarkers("src/first.ts");

    await vi.waitFor(() => expect(text()).not.toContain("演習の開始時点では"));
  });

  it("does not show the type check result while read-only", async () => {
    const { host } = await renderHydratedEditor({
      ...baseProps,
      readOnly: true,
    });

    expect(host.querySelector('section[aria-label="型検査の結果"]')).toBeNull();
  });

  it("revalidates other models after an edit and a file switch", async () => {
    const mounted = await renderHydratedEditor({ ...baseProps });
    const { addExtraLib } = monacoState.monaco.typescript.typescriptDefaults;
    const revalidateCalls = () =>
      addExtraLib.mock.calls.filter(
        ([, path]) => path === "file:///workspace/playground-revalidate.d.ts",
      );

    monacoState.modelFor("src/first.ts")!.setValue("const first = false;");
    await mounted.rerender({
      ...baseProps,
      path: "src/second.ts",
      value: projectFiles["src/second.ts"],
    });
    expect(revalidateCalls()).toHaveLength(1);

    await mounted.rerender({ ...baseProps });
    expect(revalidateCalls()).toHaveLength(1);
  });

  it("does not revalidate when files are switched without an edit", async () => {
    const mounted = await renderHydratedEditor({ ...baseProps });
    const { addExtraLib } = monacoState.monaco.typescript.typescriptDefaults;

    await mounted.rerender({
      ...baseProps,
      path: "src/second.ts",
      value: projectFiles["src/second.ts"],
    });

    expect(addExtraLib).not.toHaveBeenCalledWith(
      expect.anything(),
      "file:///workspace/playground-revalidate.d.ts",
    );
  });
});

describe("buildAmbientModules", () => {
  const manifest = JSON.stringify({
    dependencies: { zod: "^3.0.0" },
    devDependencies: { vitest: "^2.0.0", "@types/node": "^22.0.0" },
  });
  const fixed =
    'declare module "@fp-with-ts/clinic-web";\ndeclare module "@fp-with-ts/clinic-web/*";\ndeclare module "node:*";\n';

  it("declares every package from dependencies and devDependencies", () => {
    expect(buildAmbientModules({ "package.json": manifest }, {})).toBe(
      [
        'declare module "zod";',
        'declare module "zod/*";',
        'declare module "vitest";',
        'declare module "vitest/*";',
        'declare module "@types/node";',
        'declare module "@types/node/*";',
        "",
      ].join("\n") + fixed,
    );
  });

  it("leaves out packages whose types have arrived", () => {
    const result = buildAmbientModules(
      { "package.json": manifest },
      {
        "file:///workspace/node_modules/zod/package.json": "{}",
        "node_modules/vitest/package.json": "{}",
      },
    );

    expect(result).not.toContain('"zod"');
    expect(result).not.toContain('"vitest"');
    expect(result).toContain('declare module "@types/node";');
    expect(result.endsWith(fixed)).toBe(true);
  });

  it("returns only the fixed lines for a missing or broken package.json", () => {
    expect(buildAmbientModules({}, {})).toBe(fixed);
    expect(buildAmbientModules({ "package.json": "{ broken" }, {})).toBe(fixed);
  });
});
