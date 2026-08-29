import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import type { CodeHighlight } from "../../code-explorer/code-guide";
import type { EditorProps } from "./CodeExplorer";

type MonacoApi = typeof Monaco;

type EditorResources = {
  monaco: MonacoApi;
  models: Map<string, Monaco.editor.ITextModel>;
  ownedModels: Set<Monaco.editor.ITextModel>;
  extraLibs: Monaco.IDisposable[];
  applyingExternalChange: boolean;
};

type EditorRuntime = EditorResources & {
  editor: Monaco.editor.IStandaloneCodeEditor;
  changeSubscription?: Monaco.IDisposable;
  highlightDecorations?: Monaco.editor.IEditorDecorationsCollection;
};

export const modelUriFor = (path: string): string => `file:///${path}`;

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

const configureTypeScript = (monaco: MonacoApi): void => {
  monaco.typescript.typescriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    module: monaco.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    target: monaco.typescript.ScriptTarget.ES2020,
  });
};

const ensureProjectModels = (
  runtime: EditorResources,
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

    if (model.getValue() !== source) {
      runtime.applyingExternalChange = true;
      try {
        model.setValue(source);
      } finally {
        runtime.applyingExternalChange = false;
      }
    }
  }
};

const registerExtraLibs = (
  runtime: EditorResources,
  typeFiles: EditorProps["typeFiles"],
): void => {
  for (const disposable of runtime.extraLibs) disposable.dispose();
  runtime.extraLibs = [];

  for (const [path, source] of Object.entries(typeFiles)) {
    runtime.extraLibs.push(
      runtime.monaco.typescript.typescriptDefaults.addExtraLib(
        source,
        path.startsWith("file:///") ? path : `file:///${path}`,
      ),
    );
  }
};

const synchronizeValue = (
  runtime: EditorResources,
  model: Monaco.editor.ITextModel | undefined,
  value: string,
): void => {
  if (model === undefined || model.getValue() === value) return;

  runtime.applyingExternalChange = true;
  try {
    model.setValue(value);
  } finally {
    runtime.applyingExternalChange = false;
  }
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

  latestProps.current = props;
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const { monaco } = await import("./monaco-client");
      if (cancelled || editorHost.current === null) return;

      configureTypeScript(monaco);
      const current = latestProps.current;
      const resources: EditorResources = {
        monaco,
        models: new Map(),
        ownedModels: new Set(),
        extraLibs: [],
        applyingExternalChange: false,
      };
      ensureProjectModels(resources, current.files);
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
      current.editor.dispose();
      for (const model of current.ownedModels) model.dispose();
      runtime.current = undefined;
    };
  }, []);

  useEffect(() => {
    const current = runtime.current;
    if (!ready || current === undefined) return;
    ensureProjectModels(current, files);
  }, [files, ready]);

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
    </div>
  );
};
