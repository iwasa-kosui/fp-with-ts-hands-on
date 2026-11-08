import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { aggregate } from "./aggregate.mjs";
import { loadConfig } from "./config.mjs";
import { isRunTestFile, planCopies, readMineFiles } from "./copies.mjs";
import { classifyLint, lintFailureProblem, ruleDifferenceProblem, runLint } from "./lint.mjs";
import {
  defaultEslintConfig,
  defaultMineDir,
  defaultWorkDir,
} from "./model.mjs";
import { displayPath, isInside } from "./paths.mjs";
import {
  buildVitestConfig,
  classifyVitest,
  defaultTestTimeoutMs,
  findVitest,
  readVitestJson,
  runVitest,
  vitestSetupName,
  vitestSetupSource,
  testsIncompleteProblem,
  testsProblem,
  testsTimeoutProblem,
} from "./tests.mjs";
import { buildTsconfig, classifyDiagnostics, configProblems, runTypecheck } from "./typecheck.mjs";
import { findUnchanged } from "./unchanged.mjs";

/** @typedef {import("./model.mjs").Detection} Detection */
/** @typedef {import("./model.mjs").Evidence} Evidence */
/** @typedef {import("./model.mjs").GuardResult} GuardResult */
/** @typedef {import("./model.mjs").Problem} Problem */
/** @typedef {Readonly<{ root: string, mineDir?: string, eslintConfigFile?: string, workDir?: string, revealAllStages?: boolean, testTimeoutMs?: number, isolate?: boolean, onVitestSpawn?: (pid: number) => void }>} JudgeOptions */

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
 * @param {Readonly<{
 *   root: string,
 *   workDir: string,
 *   copiesDir: string,
 *   caseDirs: Readonly<Record<string, string>>,
 *   expectedFiles: readonly string[],
 *   baseConfigFile: string | undefined,
 *   timeoutMs: number,
 *   isolate: boolean,
 *   onSpawn: ((pid: number) => void) | undefined,
 *   mineDisplay: (rel: string) => string,
 * }>} input
 * @returns {Promise<Readonly<{ problems: readonly Problem[], evidence: Evidence, collectionErrors: Readonly<Record<string, readonly Detection[]>>, seconds: number }>>}
 */
const runTests = async ({
  root,
  workDir,
  copiesDir,
  caseDirs,
  expectedFiles,
  baseConfigFile,
  timeoutMs,
  isolate,
  onSpawn,
  mineDisplay,
}) => {
  const start = performance.now();
  const failure = (/** @type {Problem} */ problem) => ({
    problems: [problem],
    evidence: { failed: true, byCase: {} },
    collectionErrors: {},
    seconds: (performance.now() - start) / 1000,
  });
  const vitestFile = findVitest(root);
  if (vitestFile === undefined) {
    return failure(testsProblem("vitest が見つかりません。node_modules に vitest を入れます。"));
  }
  const configFile = path.join(workDir, "vitest.config.mjs");
  const outputFile = path.join(workDir, "vitest.json");
  writeFileSync(path.join(workDir, vitestSetupName), vitestSetupSource);
  writeFileSync(configFile, buildVitestConfig({ root, workDir, isolate, baseConfigFile }));
  const exit = await runVitest({ root, vitestFile, configFile, outputFile, timeoutMs, onSpawn });
  if (exit.status === "timeout") {
    return failure(testsTimeoutProblem(timeoutMs));
  }
  const classified = classifyVitest(readVitestJson(outputFile), { copiesDir, caseDirs, expectedFiles, mineDisplay });
  if (classified === undefined) {
    return failure(
      testsProblem(`テストの結果を読めませんでした。${exit.stderrTail.trim().split("\n").slice(-3).join(" ")}`.trim()),
    );
  }
  const incomplete = classified.incompleteCaseIds;
  return {
    problems: incomplete.length > 0 ? [testsIncompleteProblem(incomplete.length)] : [],
    evidence: { failed: incomplete.length > 0, byCase: classified.byCase },
    collectionErrors: classified.collectionErrors,
    seconds: (performance.now() - start) / 1000,
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
    subjectFiles: Object.values(config.subjects),
    cases: config.cases,
    caseFiles,
    copiesDir,
    mineDisplay,
  });
  writeWorkFiles(workDir, buildTsconfig({ root, workDir, casesDir }), plan.copies);

  const expectedFiles = plan.copies.filter((copy) => isRunTestFile(copy.dest)).map((copy) => copy.dest);
  const timeoutMs = options.testTimeoutMs ?? defaultTestTimeoutMs;
  const testsPromise =
    expectedFiles.length > 0
      ? runTests({
          root,
          workDir,
          copiesDir,
          caseDirs: plan.caseDirs,
          expectedFiles,
          baseConfigFile:
            config.vitestBaseConfig === undefined ? undefined : path.resolve(root, config.vitestBaseConfig),
          timeoutMs,
          isolate: options.isolate ?? false,
          onSpawn: options.onVitestSpawn,
          mineDisplay,
        })
      : Promise.resolve(undefined);

  /** @type {import("typescript").Program | undefined} */
  let sharedProgram;
  const typesRun = timed(() => {
    try {
      const run = runTypecheck(path.join(workDir, "tsconfig.json"));
      sharedProgram = run.program;
      return {
        classified: classifyDiagnostics(run.diagnostics, { root, copiesDir, casesDir, caseDirs: plan.caseDirs, mineDisplay }),
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
        caseFiles,
        program: sharedProgram,
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
  const differingCases = lintRun.value.run?.differingCases ?? [];
  const problems = capProblems([
    ...(typesFailure === undefined
      ? []
      : [{ message: `型検査を完了できませんでした: ${messageOf(typesFailure)}`, fix: "tsconfig.json の設定を直します。" }]),
    ...typesRun.value.configProblems,
    ...(typesClassified?.problems ?? []),
    ...(lintFailure === undefined ? [] : [lintFailureProblem(lintFailure)]),
    ...(lintClassified?.problems ?? []),
    ...(differingCases.length > 0 ? [ruleDifferenceProblem(differingCases)] : []),
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
    noJudgedFiles: plan.copies.length === 0,
    unchangedIds: findUnchanged(config.cases, caseFiles),
    durations,
    revealAllStages: options.revealAllStages === true,
  });
  writeFileSync(path.join(workDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  return result;
};
