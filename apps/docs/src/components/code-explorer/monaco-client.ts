import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

globalThis.MonacoEnvironment = {
  getWorker: (_moduleId, label) =>
    label === "typescript" || label === "javascript"
      ? new tsWorker()
      : new editorWorker(),
};

export { monaco };
