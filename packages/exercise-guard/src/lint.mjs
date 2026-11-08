import path from "node:path";
import { displayPath, toPosix } from "./paths.mjs";

/** @typedef {import("./model.mjs").Detection} Detection */
/** @typedef {import("./model.mjs").Problem} Problem */
/** @typedef {Readonly<{ ruleId: string | null, severity: number, line: number, message: string, fatal: boolean }>} LintMessage */
/** @typedef {Readonly<{ filePath: string, messages: readonly LintMessage[] }>} LintFileResult */
/** @typedef {Readonly<{ results: readonly LintFileResult[], differingCases: readonly string[] }>} LintRun */

/**
 * @param {unknown} error
 * @returns {string}
 */
const firstLine = (error) =>
  (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";

/**
 * @param {{ rules?: Record<string, unknown> } | undefined} config
 * @returns {string}
 */
const ruleSignature = (config) => (config === undefined ? "none" : JSON.stringify(config.rules ?? {}));

/**
 * @param {readonly (readonly [string, string])[]} signatures
 * @returns {readonly string[]}
 */
const differingCases = (signatures) => {
  const groups = Object.values(
    signatures.reduce(
      (acc, [id, signature]) => ({ ...acc, [signature]: [...(acc[signature] ?? []), id] }),
      /** @type {Readonly<Record<string, readonly string[]>>} */ ({}),
    ),
  ).sort((left, right) => right.length - left.length);
  return groups.slice(1).flat();
};

/**
 * @param {Readonly<{ root: string, eslintConfigFile: string, patterns: readonly string[], caseFiles: Readonly<Record<string, string>>, program?: import("typescript").Program | undefined }>} input
 * @returns {Promise<LintRun>}
 */
export const runLint = async ({ root, eslintConfigFile, patterns, caseFiles, program }) => {
  const { ESLint } = await import("eslint");
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: eslintConfigFile,
    ...(program === undefined
      ? {}
      : { overrideConfig: [{ files: ["**/*.ts"], languageOptions: { parserOptions: { projectService: false, programs: [program] } } }] }),
    allowInlineConfig: false,
    errorOnUnmatchedPattern: false,
  });
  const results = await eslint.lintFiles([...patterns]);
  const signatures = await Promise.all(
    Object.entries(caseFiles).map(async ([id, file]) => {
      const signature = await eslint.calculateConfigForFile(file).then(ruleSignature, () => "error");
      return /** @type {const} */ ([id, signature]);
    }),
  );
  return {
    results: results.map((result) => ({
      filePath: result.filePath,
      messages: result.messages.map((message) => ({
        ruleId: message.ruleId,
        severity: message.severity,
        line: message.line,
        message: message.message,
        fatal: message.fatal === true,
      })),
    })),
    differingCases: differingCases(signatures),
  };
};

const byNameFix = "規則をファイル名で分けずに、コードの形で検出します。";

/**
 * @param {readonly string[]} ids
 * @returns {Problem}
 */
export const ruleDifferenceProblem = (ids) => ({
  message: `eslint.config.mjs の規則がケースによって違います（${ids.join("、")}）`,
  fix: byNameFix,
});

/**
 * @param {unknown} error
 * @returns {Problem}
 */
export const lintFailureProblem = (error) => {
  const rule = /Rule: "([^"]+)"/.exec(error instanceof Error ? error.message : String(error))?.[1];
  return rule === undefined
    ? {
        message: `eslint.config.mjs を読み込めませんでした: ${firstLine(error)}`,
        fix: "eslint.config.mjs の構文と import を見直します。",
      }
    : {
        message: `規則 ${rule} の実行中にエラーが出ました（${firstLine(error)}）。`,
        fix: `規則 ${rule} の書き方を見直します。`,
      };
};

/**
 * @param {string} filePath
 * @param {string} casesDir
 * @returns {string}
 */
const caseIdOf = (filePath, casesDir) =>
  (toPosix(path.relative(casesDir, filePath)).split("/")[0] ?? "").replace(/\.ts$/, "");

/**
 * @param {readonly LintFileResult[]} results
 * @param {Readonly<{ root: string, casesDir: string, caseFiles: Readonly<Record<string, string>> }>} context
 * @returns {Readonly<{ byCase: Readonly<Record<string, readonly Detection[]>>, problems: readonly Problem[], notes: readonly string[] }>}
 */
export const classifyLint = (results, { root, casesDir, caseFiles }) => {
  const isUnmatched = (/** @type {LintFileResult} */ result) =>
    result.messages.some((message) => /no matching configuration/i.test(message.message));
  const reported = new Set(results.filter((result) => !isUnmatched(result)).map((result) => result.filePath));
  const unmatched = Object.values(caseFiles)
    .filter((file) => !reported.has(file))
    .map((file) => displayPath(root, file));
  const entries = results.flatMap((result) =>
    result.messages.map((message) => ({ result, message })),
  );
  const errors = entries.filter(({ message }) => message.severity === 2 && message.ruleId !== null);
  const warnings = entries.filter(({ message }) => message.severity === 1 && message.ruleId !== null);
  const fatals = entries.filter(({ message }) => message.ruleId === null && message.fatal);
  const byCase = errors.reduce(
    (acc, { result, message }) => {
      const id = caseIdOf(result.filePath, casesDir);
      /** @type {Detection} */
      const detection = {
        mechanism: "lint",
        file: displayPath(root, result.filePath),
        line: message.line,
        label: message.ruleId ?? "",
        message: message.message,
      };
      return { ...acc, [id]: [...(acc[id] ?? []), detection] };
    },
    /** @type {Readonly<Record<string, readonly Detection[]>>} */ ({}),
  );
  return {
    byCase,
    problems: fatals.map(({ result, message }) => ({
      message: `${displayPath(root, result.filePath)}:${message.line} ${message.message}`,
      fix: "Linter が読み込めないファイルを直します。",
    })),
    notes: [
      ...(unmatched.length > 0
        ? [`eslint.config.mjs の files がこのファイルを対象にしていません: ${unmatched.join(", ")}`]
        : []),
      ...(warnings.length > 0
        ? [
            `warn は検出に数えません（${[...new Set(warnings.map(({ message }) => message.ruleId))].join(", ")}）。error にすると検出に数えます。`,
          ]
        : []),
    ],
  };
};
