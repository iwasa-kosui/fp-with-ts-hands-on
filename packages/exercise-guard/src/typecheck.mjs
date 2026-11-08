import path from "node:path";
import ts from "typescript";
import { displayPath, isInside, relativeSpecifier, toPosix } from "./paths.mjs";

/** @typedef {import("./model.mjs").Detection} Detection */
/** @typedef {import("./model.mjs").Problem} Problem */
/** @typedef {Readonly<{ file: string | undefined, line: number | null, code: number, message: string }>} PlainDiagnostic */
/** @typedef {Readonly<{ program?: ts.Program, diagnostics: readonly PlainDiagnostic[], configErrors: readonly PlainDiagnostic[] }>} TypecheckRun */

const projectErrorFix = "プロジェクトの型エラーを直します。";
const unusedExpectErrorCode = 2578;
const unusedExpectErrorMessage = "この @ts-expect-error の次の行に、型のエラーが出ませんでした";

/**
 * @param {Readonly<{ root: string, workDir: string, casesDir: string }>} paths
 * @returns {Readonly<Record<string, unknown>>}
 */
export const buildTsconfig = ({ root, workDir, casesDir }) => ({
  extends: relativeSpecifier(workDir, path.join(root, "tsconfig.json")),
  compilerOptions: { noEmit: true, incremental: false, composite: false },
  include: [`${toPosix(path.relative(workDir, casesDir))}/**/*.ts`, "copies/**/*.ts"],
  exclude: [],
});

const localizeMessages = () => {
  const file = path.join(
    path.dirname(ts.sys.getExecutingFilePath()),
    "ja",
    "diagnosticMessages.generated.json",
  );
  const text = ts.sys.readFile(file);
  const internal = /** @type {{ setLocalizedDiagnosticMessages?: (messages: unknown) => void }} */ (
    /** @type {unknown} */ (ts)
  );
  if (text !== undefined && typeof internal.setLocalizedDiagnosticMessages === "function") {
    internal.setLocalizedDiagnosticMessages(JSON.parse(text));
  }
};

/**
 * @param {ts.Diagnostic} diagnostic
 * @returns {PlainDiagnostic}
 */
const toPlain = (diagnostic) => ({
  file: diagnostic.file?.fileName,
  line:
    diagnostic.file === undefined || diagnostic.start === undefined
      ? null
      : ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start).line + 1,
  code: diagnostic.code,
  message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
});

/**
 * @param {string} configPath
 * @returns {TypecheckRun}
 */
export const runTypecheck = (configPath) => {
  localizeMessages();
  /** @type {ts.Diagnostic[]} */
  const unrecoverable = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        unrecoverable.push(diagnostic);
      },
    },
  );
  if (parsed === undefined) {
    return { diagnostics: [], configErrors: unrecoverable.map(toPlain) };
  }
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    ...(parsed.projectReferences === undefined ? {} : { projectReferences: parsed.projectReferences }),
  });
  return {
    program,
    diagnostics: ts
      .getPreEmitDiagnostics(program)
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
      .map(toPlain),
    configErrors: parsed.errors.filter((diagnostic) => diagnostic.code !== 18003).map(toPlain),
  };
};

/**
 * @param {Readonly<Record<string, readonly Detection[]>>} record
 * @param {string} key
 * @param {Detection} item
 * @returns {Readonly<Record<string, readonly Detection[]>>}
 */
const appendTo = (record, key, item) => ({ ...record, [key]: [...(record[key] ?? []), item] });

/**
 * @param {PlainDiagnostic} diagnostic
 * @param {string} root
 * @returns {string}
 */
const describe = (diagnostic, root) =>
  `${diagnostic.file === undefined ? "(プロジェクト)" : displayPath(root, diagnostic.file)}${
    diagnostic.line === null ? "" : `:${diagnostic.line}`
  } TS${diagnostic.code}: ${diagnostic.message.split("\n")[0]}`;

/**
 * @param {readonly PlainDiagnostic[]} diagnostics
 * @param {Readonly<{ root: string, copiesDir: string, casesDir: string, caseDirs: Readonly<Record<string, string>>, mineDisplay: (rel: string) => string }>} context
 * @returns {Readonly<{ byCase: Readonly<Record<string, readonly Detection[]>>, builtin: Readonly<Record<string, readonly Detection[]>>, problems: readonly Problem[] }>}
 */
export const classifyDiagnostics = (diagnostics, { root, copiesDir, casesDir, caseDirs, mineDisplay }) =>
  diagnostics.reduce(
    (acc, diagnostic) => {
      const file = diagnostic.file;
      /** @param {string} fileLabel @returns {Detection} */
      const detection = (fileLabel) => ({
        mechanism: "types",
        file: fileLabel,
        line: diagnostic.line,
        label: `TS${diagnostic.code}`,
        message: diagnostic.code === unusedExpectErrorCode ? unusedExpectErrorMessage : diagnostic.message,
      });
      if (file !== undefined && isInside(copiesDir, file)) {
        const [caseDir = "", ...rest] = toPosix(path.relative(copiesDir, file)).split("/");
        return {
          ...acc,
          byCase: appendTo(acc.byCase, caseDirs[caseDir] ?? caseDir, detection(mineDisplay(rest.join("/")))),
        };
      }
      if (file !== undefined && isInside(casesDir, file)) {
        const [first = ""] = toPosix(path.relative(casesDir, file)).split("/");
        return {
          ...acc,
          builtin: appendTo(acc.builtin, first.replace(/\.ts$/, ""), detection(displayPath(root, file))),
        };
      }
      return {
        ...acc,
        problems: [...acc.problems, { message: describe(diagnostic, root), fix: projectErrorFix }],
      };
    },
    {
      byCase: /** @type {Readonly<Record<string, readonly Detection[]>>} */ ({}),
      builtin: /** @type {Readonly<Record<string, readonly Detection[]>>} */ ({}),
      problems: /** @type {readonly Problem[]} */ ([]),
    },
  );

/**
 * @param {readonly PlainDiagnostic[]} configErrors
 * @param {string} root
 * @returns {readonly Problem[]}
 */
export const configProblems = (configErrors, root) =>
  configErrors.map((diagnostic) => ({
    message: `tsconfig.json: ${describe(diagnostic, root)}`,
    fix: "tsconfig.json の設定を直します。",
  }));
