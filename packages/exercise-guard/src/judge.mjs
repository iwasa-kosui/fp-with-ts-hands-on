import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { aggregate } from "./aggregate.mjs";
import { loadConfig } from "./config.mjs";
import { isTestFile, planCopies, readMineFiles } from "./copies.mjs";
import { classifyLint, lintFailureProblem, runLint } from "./lint.mjs";
import {
  defaultEslintConfig,
  defaultMineDir,
  defaultWorkDir,
} from "./model.mjs";
import { displayPath, isInside } from "./paths.mjs";
import {
  buildVitestConfig,
  classifyVitest,
  findVitest,
  readVitestJson,
  runVitest,
  testsProblem,
} from "./tests.mjs";
import { buildTsconfig, classifyDiagnostics, configProblems, runTypecheck } from "./typecheck.mjs";

/** @typedef {import("./model.mjs").Detection} Detection */
/** @typedef {import("./model.mjs").Evidence} Evidence */
/** @typedef {import("./model.mjs").GuardResult} GuardResult */
/** @typedef {import("./model.mjs").Problem} Problem */
/** @typedef {Readonly<{ root: string, mineDir?: string, eslintConfigFile?: string, workDir?: string, revealAllStages?: boolean }>} JudgeOptions */

const maxProblems = 10;

/**
 * @template T
 * @param {() => T} run
 * @returns {Readonly<{ value: T, seconds: number }>}
 */
const timed = (run) => {
  const start = performance.now();
  const value = run();
  return { value, seconds: (performance.now() - start) / 1000 };
};

/**
 * @template T
 * @param {() => Promise<T>} run
 * @returns {Promise<Readonly<{ value: T, seconds: number }>>}
 */
const timedAsync = async (run) => {
  const start = performance.now();
  const value = await run();
  return { value, seconds: (performance.now() - start) / 1000 };
};

/**
 * @param {unknown} error
 * @returns {string}
 */
const messageOf = (error) => (error instanceof Error ? error.message : String(error));

/**
 * @param {number} seconds
 * @returns {number}
 */
const round = (seconds) => Math.round(seconds * 10) / 10;

/**
 * @param {readonly Problem[]} problems
 * @returns {readonly Problem[]}
 */
const capProblems = (problems) =>
  problems.length <= maxProblems
    ? problems
    : [
        ...problems.slice(0, maxProblems),
        { message: `ほか ${problems.length - maxProblems} 件`, fix: problems[0]?.fix ?? "" },
      ];

/**
 * @param {string} workDir
 * @param {Readonly<Record<string, unknown>>} tsconfig
 * @param {readonly Readonly<{ dest: string, text: string }>[]} copies
 * @returns {void}
 */
const writeWorkFiles = (workDir, tsconfig, copies) => {
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  copies.forEach(({ dest, text }) => {
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, text);
  });
  writeFileSync(path.join(workDir, "tsconfig.json"), `${JSON.stringify(tsconfig, null, 2)}\n`);
};

/**
 * @param {Readonly<{ root: string, workDir: string, copiesDir: string, mineDisplay: (rel: string) => string }>} input
 * @returns {Promise<Readonly<{ problems: readonly Problem[], evidence: Evidence, collectionErrors: Readonly<Record<string, readonly Detection[]>>, seconds: number }>>}
 */
const runTests = async ({ root, workDir, copiesDir, mineDisplay }) => {
  const start = performance.now();
  const vitestFile = findVitest(root);
  const failure = (/** @type {string} */ message) => ({
    problems: [testsProblem(message)],
    evidence: { failed: true, byCase: {} },
    collectionErrors: {},
    seconds: (performance.now() - start) / 1000,
  });
  if (vitestFile === undefined) {
    return failure("vitest が見つかりません。node_modules に vitest を入れます。");
  }
  const configFile = path.join(workDir, "vitest.config.mjs");
  const outputFile = path.join(workDir, "vitest.json");
  writeFileSync(configFile, buildVitestConfig({ root, workDir }));
  const exit = await runVitest({ root, vitestFile, configFile, outputFile });
  const classified = classifyVitest(readVitestJson(outputFile), { copiesDir, mineDisplay });
  const seconds = (performance.now() - start) / 1000;
  if (exit.status === "timeout") {
    return failure("テストが 60 秒で終わらなかったので、結果を読めませんでした。無限ループになっていないか見直します。");
  }
  if (classified === undefined) {
    return failure(
      `テストの結果を読めませんでした。${exit.stderrTail.trim().split("\n").slice(-3).join(" ")}`.trim(),
    );
  }
  return {
    problems: [],
    evidence: { failed: false, byCase: classified.byCase },
    collectionErrors: classified.collectionErrors,
    seconds,
  };
};

/**
 * @param {JudgeOptions} options
 * @returns {Promise<GuardResult>}
 */
export const judge = async (options) => {
  const startedAt = performance.now();
  const root = path.resolve(options.root);
  const mineDir = path.resolve(root, options.mineDir ?? defaultMineDir);
  const eslintConfigFile = path.resolve(root, options.eslintConfigFile ?? defaultEslintConfig);
  const workDir = path.resolve(root, options.workDir ?? defaultWorkDir);
  if (!isInside(root, workDir)) {
    throw new Error(`workDir は root の中に置きます: ${workDir}`);
  }
  const casesDir = path.join(root, "exercises/guard/cases");
  const copiesDir = path.join(workDir, "copies");
  const mineDisplay = (/** @type {string} */ rel) => displayPath(root, path.join(mineDir, rel));

  const { config, caseFiles } = await loadConfig(root);
  const mineFiles = readMineFiles(mineDir);
  const plan = planCopies({
    mineFiles,
    subjectPaths: Object.fromEntries(
      Object.entries(config.subjects).map(([name, file]) => [name, path.resolve(root, file)]),
    ),
    cases: config.cases,
    caseFiles,
    copiesDir,
    mineDisplay,
  });
  writeWorkFiles(workDir, buildTsconfig({ root, workDir, casesDir }), plan.copies);

  const testsPromise = plan.copies.some((copy) => isTestFile(copy.dest))
    ? runTests({ root, workDir, copiesDir, mineDisplay })
    : Promise.resolve(undefined);

  const typesRun = timed(() => {
    try {
      const run = runTypecheck(path.join(workDir, "tsconfig.json"));
      return {
        classified: classifyDiagnostics(run.diagnostics, { root, copiesDir, casesDir, mineDisplay }),
        configProblems: configProblems(run.configErrors, root),
        failure: undefined,
      };
    } catch (error) {
      return { classified: undefined, configProblems: [], failure: error };
    }
  });

  const lintRun = await timedAsync(async () => {
    try {
      const run = await runLint({
        root,
        eslintConfigFile,
        patterns: ["exercises/guard/cases/**/*.ts"],
        sampleFile: Object.values(caseFiles)[0],
      });
      return { run, classified: classifyLint(run.results, { root, casesDir, caseFiles }), failure: undefined };
    } catch (error) {
      return { run: undefined, classified: undefined, failure: error };
    }
  });

  const testsRun = await testsPromise;

  const typesFailure = typesRun.value.failure;
  const lintFailure = lintRun.value.failure;
  const typesClassified = typesRun.value.classified;
  const lintClassified = lintRun.value.classified;
  const problems = capProblems([
    ...(typesFailure === undefined
      ? []
      : [{ message: `型検査を完了できませんでした: ${messageOf(typesFailure)}`, fix: "tsconfig.json の設定を直します。" }]),
    ...typesRun.value.configProblems,
    ...(typesClassified?.problems ?? []),
    ...(lintFailure === undefined ? [] : [lintFailureProblem(lintFailure)]),
    ...(lintClassified?.problems ?? []),
    ...(testsRun?.problems ?? []),
  ]);
  const durations = {
    types: round(typesRun.seconds),
    lint: round(lintRun.seconds),
    tests: round(testsRun?.seconds ?? 0),
    total: round((performance.now() - startedAt) / 1000),
  };
  const result = aggregate({
    cases: config.cases,
    evidence: {
      types: { failed: typesFailure !== undefined, byCase: typesClassified?.byCase ?? {} },
      lint: { failed: lintFailure !== undefined, byCase: lintClassified?.byCase ?? {} },
      tests: testsRun?.evidence ?? { failed: false, byCase: {} },
    },
    builtin: typesClassified?.builtin ?? {},
    collectionErrors: testsRun?.collectionErrors ?? {},
    problems,
    notes: [...plan.notes, ...(lintClassified?.notes ?? [])],
    mineEmpty: mineFiles.length === 0,
    ruleCount: lintRun.value.run?.ruleCount ?? null,
    durations,
    revealAllStages: options.revealAllStages === true,
  });
  writeFileSync(path.join(workDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  return result;
};
