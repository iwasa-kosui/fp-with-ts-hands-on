import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
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
};

export const modelUriFor = (path: string): string => `file:///${path}`;

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
  for (const [path, source] of Object.entries(files)) {
    if (!path.endsWith(".ts")) continue;

    let model = runtime.models.get(path);
    if (model === undefined) {
      const uri = runtime.monaco.Uri.parse(modelUriFor(path));
      const existingModel = runtime.monaco.editor.getModel(uri);
      model =
        existingModel ??
        runtime.monaco.editor.createModel(source, "typescript", uri);
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

export const MonacoEditor = (props: EditorProps) => {
  const { path, value, files, typeFiles, disabled, onChange } = props;
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
        model: resources.models.get(current.path) ?? null,
        readOnly: current.disabled,
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
    current.editor.updateOptions({ readOnly: disabled });
  }, [disabled, ready]);

  return (
    <div className="code-explorer__monaco">
      {ready ? null : (
        <pre aria-label={`コード: ${path}`}>
          <code>{`${path}\n${value}`}</code>
        </pre>
      )}
      <div ref={editorHost} aria-label={`コードエディタ: ${path}`} />
    </div>
  );
};
