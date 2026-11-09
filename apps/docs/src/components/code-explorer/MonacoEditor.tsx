import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import type { CodeHighlight } from "../../code-explorer/code-guide";
import { buildAmbientModules } from "./ambient-modules";
import { editorCompilerOptions } from "./editor-compiler-options";
import type { EditorProps } from "./CodeExplorer";

type MonacoApi = typeof Monaco;

const ambientPath = "file:///workspace/playground-ambient.d.ts";
const revalidatePath = "file:///workspace/playground-revalidate.d.ts";
const missingTypeCodes = [7006, 7031, 2580, 2591, 2582, 2593, 2347, 2694, 2709, 2698, 2571, 18046];

type EditorResources = {
  monaco: MonacoApi;
  models: Map<string, Monaco.editor.ITextModel>;
  ownedModels: Set<Monaco.editor.ITextModel>;
  extraLibs: Monaco.IDisposable[];
  ambient?: { source: string; disposable: Monaco.IDisposable };
  revalidateLib?: Monaco.IDisposable;
  revalidateCount: number;
  seenVersions: WeakMap<Monaco.editor.ITextModel, number>;
  applyingExternalChange: boolean;
};

type Diagnostic = {
  key: string;
  line: number;
  column: number;
  message: string;
  code: string | undefined;
};

type EditorRuntime = EditorResources & {
  editor: Monaco.editor.IStandaloneCodeEditor;
  changeSubscription?: Monaco.IDisposable;
  highlightDecorations?: Monaco.editor.IEditorDecorationsCollection;
};

export const modelUriFor = (path: string): string =>
  new URL(path, "file:///workspace/").href;

const languageForPath = (path: string): string => {
  const extension = path.toLowerCase().split(".").at(-1);
  switch (extension) {
    case "ts":
    case "tsx":
    case "mts":
    case "cts":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "css":
      return "css";
    case "html":
    case "htm":
      return "html";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "plaintext";
  }
};

const applyDiagnosticsOptions = (
  monaco: MonacoApi,
  typeFiles: EditorProps["typeFiles"],
): void => {
  const defaults = monaco.typescript.typescriptDefaults;
  const diagnosticCodesToIgnore =
    Object.keys(typeFiles).length === 0 ? missingTypeCodes : [];
  const current = defaults.getDiagnosticsOptions();
  if (
    current.noSemanticValidation === false &&
    current.noSyntaxValidation === false &&
    (current.diagnosticCodesToIgnore ?? []).join(",") ===
      diagnosticCodesToIgnore.join(",")
  ) {
    return;
  }
  defaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore,
  });
};

const configureTypeScript = (
  monaco: MonacoApi,
  typeFiles: EditorProps["typeFiles"],
): void => {
  monaco.typescript.typescriptDefaults.setCompilerOptions(
    editorCompilerOptions as unknown as Monaco.typescript.CompilerOptions,
  );
  monaco.typescript.typescriptDefaults.setEagerModelSync(true);
  applyDiagnosticsOptions(monaco, typeFiles);
};

const replaceModelValue = (
  runtime: EditorResources & Partial<Pick<EditorRuntime, "editor">>,
  model: Monaco.editor.ITextModel,
  value: string,
): void => {
  const { editor } = runtime;
  const viewState = editor?.getModel() === model ? editor.saveViewState() : null;
  runtime.applyingExternalChange = true;
  try {
    model.setValue(value);
    if (viewState !== null) editor?.restoreViewState(viewState);
  } finally {
    runtime.applyingExternalChange = false;
  }
};

const ensureProjectModels = (
  runtime: EditorResources & Partial<Pick<EditorRuntime, "editor">>,
  files: EditorProps["files"],
): void => {
  const currentPaths = new Set(Object.keys(files));
  for (const [path, model] of runtime.models) {
    if (currentPaths.has(path)) continue;
    runtime.models.delete(path);
    if (runtime.ownedModels.delete(model)) model.dispose();
  }

  for (const [path, source] of Object.entries(files)) {
    let model = runtime.models.get(path);
    if (model === undefined) {
      const uri = runtime.monaco.Uri.parse(modelUriFor(path));
      const existingModel = runtime.monaco.editor.getModel(uri);
      model =
        existingModel ??
        runtime.monaco.editor.createModel(source, languageForPath(path), uri);
      runtime.models.set(path, model);
      if (existingModel === null) runtime.ownedModels.add(model);
    }

    if (model.getValue() !== source) replaceModelValue(runtime, model, source);
  }
};

const registerExtraLibs = (
  runtime: EditorResources,
  typeFiles: EditorProps["typeFiles"],
): void => {
  applyDiagnosticsOptions(runtime.monaco, typeFiles);
  for (const disposable of runtime.extraLibs) disposable.dispose();
  runtime.extraLibs = [];

  for (const [path, source] of Object.entries(typeFiles)) {
    runtime.extraLibs.push(
      runtime.monaco.typescript.typescriptDefaults.addExtraLib(
        source,
        path.startsWith("file:///") ? path : `file:///workspace/${path}`,
      ),
    );
  }
};

const registerAmbientModules = (
  runtime: EditorResources,
  files: EditorProps["files"],
  typeFiles: EditorProps["typeFiles"],
): void => {
  const source = buildAmbientModules(files, typeFiles);
  if (runtime.ambient?.source === source) return;

  runtime.ambient?.disposable.dispose();
  runtime.ambient = {
    source,
    disposable: runtime.monaco.typescript.typescriptDefaults.addExtraLib(
      source,
      ambientPath,
    ),
  };
};

const takeVersionSnapshot = (runtime: EditorResources): boolean => {
  let changed = false;
  for (const model of runtime.models.values()) {
    const version = model.getVersionId();
    if (runtime.seenVersions.get(model) !== version) changed = true;
    runtime.seenVersions.set(model, version);
  }
  return changed;
};

const revalidateOtherModels = (runtime: EditorResources): void => {
  if (!takeVersionSnapshot(runtime)) return;

  runtime.revalidateCount += 1;
  runtime.revalidateLib?.dispose();
  runtime.revalidateLib =
    runtime.monaco.typescript.typescriptDefaults.addExtraLib(
      `// ${runtime.revalidateCount}\n`,
      revalidatePath,
    );
};

const readDiagnostics = (
  monaco: MonacoApi,
  model: Monaco.editor.ITextModel,
): Diagnostic[] =>
  monaco.editor
    .getModelMarkers({ owner: "typescript", resource: model.uri })
    .filter(
      ({ severity }) =>
        severity === monaco.MarkerSeverity.Error ||
        severity === monaco.MarkerSeverity.Warning,
    )
    .sort(
      (a, b) =>
        a.startLineNumber - b.startLineNumber ||
        a.startColumn - b.startColumn,
    )
    .map((marker, index) => ({
      key: `${marker.startLineNumber}:${marker.startColumn}:${index}`,
      line: marker.startLineNumber,
      column: marker.startColumn,
      message: marker.message,
      code:
        marker.code === undefined
          ? undefined
          : typeof marker.code === "string"
            ? marker.code
            : marker.code.value,
    }));

const synchronizeValue = (
  runtime: EditorResources,
  model: Monaco.editor.ITextModel | undefined,
  value: string,
): void => {
  if (model === undefined || model.getValue() === value) return;

  replaceModelValue(runtime, model, value);
};

const updateHighlights = (
  runtime: EditorRuntime,
  model: Monaco.editor.ITextModel | undefined,
  highlights: readonly CodeHighlight[],
): void => {
  runtime.highlightDecorations?.clear();
  if (model === undefined || highlights.length === 0) return;

  runtime.highlightDecorations = runtime.editor.createDecorationsCollection(
    highlights.map(({ startLineNumber, endLineNumber }) => ({
      range: new runtime.monaco.Range(
        startLineNumber,
        1,
        endLineNumber,
        model.getLineMaxColumn(endLineNumber),
      ),
      options: {
        isWholeLine: true,
        className: "code-explorer__highlighted-line",
        linesDecorationsClassName: "code-explorer__highlighted-gutter",
      },
    })),
  );
  const first = highlights[0];
  if (first !== undefined) {
    runtime.editor.revealRangeInCenter(
      new runtime.monaco.Range(
        first.startLineNumber,
        1,
        first.endLineNumber,
        1,
      ),
    );
  }
};

export const MonacoEditor = (props: EditorProps) => {
  const {
    path,
    value,
    files,
    typeFiles,
    disabled,
    readOnly,
    highlights,
    onChange,
  } = props;
  const editorHost = useRef<HTMLDivElement>(null);
  const runtime = useRef<EditorRuntime>();
  const latestProps = useRef(props);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [checkedKey, setCheckedKey] = useState<string>();
  const pendingKey = useRef<string>();
  const typesArrived = Object.keys(typeFiles).length > 0;
  const checkKey = `${path}:${typesArrived}`;
  const checkKeyRef = useRef(checkKey);

  latestProps.current = props;
  checkKeyRef.current = checkKey;
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const { monaco } = await import("./monaco-client");
      if (cancelled || editorHost.current === null) return;

      const current = latestProps.current;
      configureTypeScript(monaco, current.typeFiles);
      const resources: EditorResources = {
        monaco,
        models: new Map(),
        ownedModels: new Set(),
        extraLibs: [],
        revalidateCount: 0,
        seenVersions: new WeakMap(),
        applyingExternalChange: false,
      };
      ensureProjectModels(resources, current.files);
      takeVersionSnapshot(resources);
      registerAmbientModules(resources, current.files, current.typeFiles);
      registerExtraLibs(resources, current.typeFiles);
      const editor = monaco.editor.create(editorHost.current, {
        automaticLayout: true,
        minimap: { enabled: false },
        model: resources.models.get(current.path) ?? null,
        readOnly: current.disabled || current.readOnly,
        scrollBeyondLastColumn: 0,
        scrollbar: {
          alwaysConsumeMouseWheel: false,
          horizontal: "visible",
          horizontalHasArrows: true,
          horizontalScrollbarSize: 16,
          horizontalSliderSize: 16,
        },
        wordWrap: "off",
      });
      const nextRuntime: EditorRuntime = { ...resources, editor };
      runtime.current = nextRuntime;
      setReady(true);
    };

    void initialize();

    return () => {
      cancelled = true;
      const current = runtime.current;
      if (current === undefined) return;

      current.changeSubscription?.dispose();
      current.highlightDecorations?.clear();
      for (const disposable of current.extraLibs) disposable.dispose();
      current.ambient?.disposable.dispose();
      current.revalidateLib?.dispose();
      current.editor.dispose();
      for (const model of current.ownedModels) model.dispose();
      runtime.current = undefined;
    };
  }, []);

  useEffect(() => {
    const current = runtime.current;
    if (!ready || current === undefined) return;
    ensureProjectModels(current, files);
    registerAmbientModules(current, files, typeFiles);
  }, [files, ready, typeFiles]);

  useEffect(() => {
    const current = runtime.current;
    if (!ready || current === undefined) return;

    const model = current.models.get(path);
    if (current.editor.getModel() !== model) {
      current.editor.setModel(model ?? null);
    }
    current.changeSubscription?.dispose();
    current.changeSubscription = model?.onDidChangeContent(() => {
      if (
        !current.applyingExternalChange &&
        latestProps.current.path === path &&
        current.editor.getModel() === model
      ) {
        onChangeRef.current(current.editor.getValue());
      }
    });
    updateHighlights(current, model, highlights);
  }, [highlights, path, ready]);

  useEffect(() => {
    const current = runtime.current;
    if (!ready || current === undefined) return;
    // Monaco は別ファイルの編集では他のモデルを再検証しない。
    revalidateOtherModels(current);
  }, [path, ready]);

  useEffect(() => {
    const current = runtime.current;
    if (!ready || current === undefined) return;
    synchronizeValue(current, current.models.get(path), value);
  }, [path, ready, value]);

  useEffect(() => {
    const current = runtime.current;
    if (!ready || current === undefined) return;
    registerExtraLibs(current, typeFiles);
  }, [ready, typeFiles]);

  useEffect(() => {
    const current = runtime.current;
    if (!ready || current === undefined) return;
    current.editor.updateOptions({ readOnly: disabled || readOnly });
  }, [disabled, readOnly, ready]);

  useEffect(() => {
    const current = runtime.current;
    if (!ready || current === undefined) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      pendingKey.current = undefined;
      if (!cancelled) setCheckedKey(checkKey);
    };
    const model = current.models.get(path);
    if (model === undefined) {
      finish();
      return () => {
        cancelled = true;
      };
    }

    const waitForMarkers = (delay: number) => {
      const found = readDiagnostics(current.monaco, model);
      if (found.length > 0) {
        setDiagnostics(found);
        finish();
        return;
      }
      pendingKey.current = checkKey;
      timer = setTimeout(finish, delay);
    };

    const waitForCheck = async () => {
      try {
        const getWorker = await current.monaco.typescript.getTypeScriptWorker();
        const worker = await getWorker(model.uri);
        const found = await worker.getSemanticDiagnostics(model.uri.toString());
        if (cancelled) return;
        const ignored =
          current.monaco.typescript.typescriptDefaults.getDiagnosticsOptions()
            .diagnosticCodesToIgnore ?? [];
        const count = found.filter(({ code }) => !ignored.includes(code)).length;
        waitForMarkers(count === 0 ? 500 : 3000);
      } catch {
        if (cancelled) return;
        waitForMarkers(3000);
      }
    };
    void waitForCheck();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (pendingKey.current === checkKey) pendingKey.current = undefined;
    };
  }, [ready, checkKey]);

  useEffect(() => {
    const current = runtime.current;
    if (!ready || readOnly || current === undefined) return;

    const model = current.models.get(path);
    if (model === undefined) {
      setDiagnostics([]);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      const found = readDiagnostics(current.monaco, model);
      setDiagnostics(found);
      if (found.length > 0 && pendingKey.current === checkKeyRef.current) {
        setCheckedKey(pendingKey.current);
        pendingKey.current = undefined;
      }
    };
    read();
    const subscription = current.monaco.editor.onDidChangeMarkers((uris) => {
      if (!uris.some((uri) => uri.toString() === model.uri.toString())) return;
      clearTimeout(timer);
      timer = setTimeout(read, 200);
    });

    return () => {
      clearTimeout(timer);
      subscription.dispose();
    };
  }, [path, readOnly, ready]);

  const moveToDiagnostic = ({ line, column }: Diagnostic): void => {
    const current = runtime.current;
    if (current === undefined) return;
    current.editor.setPosition({ lineNumber: line, column });
    current.editor.revealRangeInCenter(
      new current.monaco.Range(line, column, line, column),
    );
    current.editor.focus();
  };

  const sourceLines = value.split("\n");

  return (
    <div className="code-explorer__monaco">
      {ready ? null : (
        <pre aria-label={`コード: ${path}`}>
          <code>
            <span className="code-explorer__source-path">{path}</span>
            {sourceLines.map((line, index) => {
              const lineNumber = index + 1;
              const isHighlighted = highlights.some(
                ({ startLineNumber, endLineNumber }) =>
                  startLineNumber <= lineNumber && lineNumber <= endLineNumber,
              );
              return (
                <span
                  key={lineNumber}
                  data-line={lineNumber}
                  className={
                    isHighlighted
                      ? "code-explorer__source-line code-explorer__source-line--highlighted"
                      : "code-explorer__source-line"
                  }
                >
                  {line}
                </span>
              );
            })}
          </code>
        </pre>
      )}
      <div ref={editorHost} aria-label={`コードエディタ: ${path}`} />
      {ready && !readOnly ? (
        <section
          className="code-explorer__diagnostics"
          aria-label="型検査の結果"
        >
          <h3>
            {diagnostics.length > 0
              ? `型エラー ${diagnostics.length} 件`
              : checkedKey === checkKey
                ? "このファイルに型エラーは見つかっていません"
                : "型を検査しています"}
          </h3>
          {diagnostics.length > 0 ? (
            <p>演習の開始時点では、まだ実装していない部分が型エラーになります。実装すると消えます。</p>
          ) : null}
          {typesArrived ? null : (
            <p>ターミナルを起動すると、外部パッケージの型を使う検査も行うので、型エラーが増えることがあります。</p>
          )}
          {diagnostics.length > 0 ? (
            <ul>
              {diagnostics.map((diagnostic) => (
                <li key={diagnostic.key}>
                  <button
                    type="button"
                    onClick={() => moveToDiagnostic(diagnostic)}
                  >
                    <span>
                      {diagnostic.line}:{diagnostic.column}
                    </span>{" "}
                    <span>{diagnostic.message}</span>
                    {diagnostic.code === undefined ? null : (
                      <>
                        {" "}
                        <span>TS{diagnostic.code}</span>
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};
