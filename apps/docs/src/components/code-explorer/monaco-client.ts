import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker.js?worker";
import jsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

globalThis.MonacoEnvironment = {
  getWorker: (_moduleId, label) => {
    if (label === "typescript" || label === "javascript") return new tsWorker();
    if (label === "json") return new jsonWorker();
    return new editorWorker();
  },
};

const bracketColors = (foreground: string) =>
  Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((level) => [`editorBracketHighlight.foreground${level}`, foreground]),
  );

monaco.editor.defineTheme("fp-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: bracketColors("#000000"),
});

monaco.editor.defineTheme("fp-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [{ token: "comment", foreground: "7ca668" }],
  colors: bracketColors("#d4d4d4"),
});

export { monaco };
