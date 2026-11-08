import path from "node:path";
import { displayPath, toPosix } from "./paths.mjs";

/** @typedef {import("./model.mjs").Detection} Detection */
/** @typedef {import("./model.mjs").Problem} Problem */
/** @typedef {Readonly<{ ruleId: string | null, severity: number, line: number, message: string, fatal: boolean }>} LintMessage */
/** @typedef {Readonly<{ filePath: string, messages: readonly LintMessage[] }>} LintFileResult */
/** @typedef {Readonly<{ results: readonly LintFileResult[], ruleCount: number | null }>} LintRun */

/**
 * @param {unknown} error
 * @returns {string}
 */
const firstLine = (error) =>
  (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";

/**
 * @param {unknown} setting
 * @returns {boolean}
 */
const isEnabled = (setting) => {
  const level = Array.isArray(setting) ? setting[0] : setting;
  return level === "warn" || level === "error" || level === 1 || level === 2;
};

/**
 * @param {Readonly<{ root: string, eslintConfigFile: string, patterns: readonly string[], sampleFile: string | undefined }>} input
 * @returns {Promise<LintRun>}
 */
export const runLint = async ({ root, eslintConfigFile, patterns, sampleFile }) => {
  const { ESLint } = await import("eslint");
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: eslintConfigFile,
    allowInlineConfig: false,
    errorOnUnmatchedPattern: false,
  });
  const results = await eslint.lintFiles([...patterns]);
  const ruleCount = await (sampleFile === undefined
    ? Promise.resolve(null)
    : eslint.calculateConfigForFile(sampleFile).then(
        /** @param {{ rules?: Record<string, unknown> } | undefined} config */
        (config) => Object.values(config?.rules ?? {}).filter(isEnabled).length,
        () => null,
      ));
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
    ruleCount,
  };
};

/**
 * @param {unknown} error
 * @returns {Problem}
 */
export const lintFailureProblem = (error) => ({
  message: `eslint.config.mjs を読み込めませんでした: ${firstLine(error)}`,
  fix: "eslint.config.mjs の構文と import を見直します。",
});

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
