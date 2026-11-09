import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isInside, toPosix } from "./paths.mjs";

/** @typedef {import("./model.mjs").Detection} Detection */
/** @typedef {import("./model.mjs").Problem} Problem */
/** @typedef {Readonly<{ status: "ok" | "timeout" | "spawn-failed", stderrTail: string }>} VitestExit */
/** @typedef {Readonly<Record<string, readonly Detection[]>>} ByCase */
/** @typedef {Readonly<{ byCase: ByCase, collectionErrors: ByCase, incompleteCaseIds: readonly string[] }>} Classified */

export const defaultTestTimeoutMs = 60_000;

export const vitestSetupName = "vitest.setup.mjs";

export const vitestSetupSource = [
  'import { vi } from "vitest";',
  "",
  'const baselineKey = Symbol.for("exercise-guard.baseline");',
  "const holder = globalThis;",
  "",
  "vi.resetModules();",
  "vi.useRealTimers();",
  "vi.restoreAllMocks();",
  "vi.unstubAllGlobals();",
  "vi.unstubAllEnvs();",
  "",
  "const baseline = holder[baselineKey];",
  "if (baseline instanceof Set) {",
  "  Object.keys(holder)",
  '    .filter((key) => !baseline.has(key) && !key.startsWith("__"))',
  "    .forEach((key) => {",
  "      Reflect.deleteProperty(holder, key);",
  "    });",
  "} else {",
  "  holder[baselineKey] = new Set(Object.keys(holder));",
  "}",
  "",
].join("\n");

/**
 * @param {string} dir
 * @returns {string | undefined}
 */
export const findVitest = (dir) => {
  const candidate = path.join(dir, "node_modules", "vitest", "vitest.mjs");
  const parent = path.dirname(dir);
  return existsSync(candidate) ? candidate : parent === dir ? undefined : findVitest(parent);
};

/**
 * @param {Readonly<{ root: string, workDir: string, isolate: boolean, baseConfigFile: string | undefined }>} input
 * @returns {string}
 */
export const buildVitestConfig = ({ root, workDir, isolate, baseConfigFile }) => {
  const config = JSON.stringify(
    {
      root,
      test: {
        include: [`${toPosix(path.relative(root, workDir))}/copies/**/*.test.ts`],
        exclude: ["**/node_modules/**"],
        pool: "forks",
        poolOptions: { forks: { singleFork: !isolate, isolate } },
        testTimeout: 5000,
        setupFiles: [toPosix(path.join(workDir, vitestSetupName))],
      },
    },
    null,
    2,
  );
  return baseConfigFile === undefined
    ? `export default ${config};\n`
    : [
        `import base from ${JSON.stringify(toPosix(baseConfigFile))};`,
        "",
        'const resolved = typeof base === "function" ? await base({ command: "serve", mode: "test" }) : await base;',
        "",
        `export default {\n  ...${config.replaceAll("\n", "\n  ")},`,
        "  ...(resolved?.resolve === undefined ? {} : { resolve: resolved.resolve }),",
        "};",
        "",
      ].join("\n");
};

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {NodeJS.ProcessEnv}
 */
export const vitestEnv = (env) => ({
  ...Object.fromEntries(
    Object.entries(env).filter(([key]) => !key.startsWith("VITEST") && key !== "NODE_ENV"),
  ),
  CI: "1",
  NO_COLOR: "1",
});

/**
 * @param {number} pid
 * @returns {void}
 */
const killGroup = (pid) => {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      return;
    }
  }
};

/**
 * @param {Readonly<{ root: string, vitestFile: string, configFile: string, outputFile: string, timeoutMs: number, onSpawn: ((pid: number) => void) | undefined }>} input
 * @returns {Promise<VitestExit>}
 */
export const runVitest = ({ root, vitestFile, configFile, outputFile, timeoutMs, onSpawn }) =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [vitestFile, "run", "--config", configFile, "--reporter=json", `--outputFile=${outputFile}`],
      { cwd: root, env: vitestEnv(process.env), stdio: ["ignore", "pipe", "pipe"], detached: true },
    );
    const pid = child.pid;
    if (pid !== undefined) {
      onSpawn?.(pid);
    }
    const chunks = /** @type {string[]} */ ([]);
    const collect = (/** @type {Buffer} */ chunk) => {
      chunks.push(String(chunk));
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const tail = () => chunks.join("").slice(-400);
    const timer = setTimeout(() => {
      if (pid !== undefined) {
        killGroup(pid);
      }
      resolve({ status: "timeout", stderrTail: tail() });
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ status: "spawn-failed", stderrTail: String(error) });
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve({ status: "ok", stderrTail: tail() });
    });
  });

/**
 * @param {string} outputFile
 * @returns {unknown}
 */
export const readVitestJson = (outputFile) => {
  try {
    return JSON.parse(readFileSync(outputFile, "utf8"));
  } catch {
    return undefined;
  }
};

/**
 * @param {string} message
 * @returns {Problem}
 */
export const testsProblem = (message) => ({
  message,
  fix: "テストの構文と import を見直します。",
});

/**
 * @param {number} timeoutMs
 * @returns {Problem}
 */
export const testsTimeoutProblem = (timeoutMs) => ({
  message: `テストが ${Math.round(timeoutMs / 100) / 10} 秒で終わりませんでした。`,
  fix: "テストの中に終わらない繰り返しや、待ち続ける処理がないか見直します。",
});

/**
 * @param {number} count
 * @returns {Problem}
 */
export const testsIncompleteProblem = (count) => ({
  message: `テストの実行が途中で終わりました。実行されなかったケースが ${count} 件あります。`,
  fix: "テストの中でプロセスを落とす処理（process.exit や process.kill など）がないか見直します。",
});

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === "object" && value !== null;

/**
 * @param {unknown} json
 * @param {Readonly<{ copiesDir: string, caseDirs: Readonly<Record<string, string>>, expectedFiles: readonly string[], mineDisplay: (rel: string) => string }>} context
 * @returns {Classified | undefined}
 */
export const classifyVitest = (json, { copiesDir, caseDirs, expectedFiles, mineDisplay }) => {
  if (!isRecord(json) || !Array.isArray(json.testResults)) {
    return undefined;
  }
  const fileResults = json.testResults.filter(isRecord);
  /** @param {string} name @returns {string} */
  const caseIdOfFile = (name) => {
    const [caseDir = ""] = toPosix(path.relative(copiesDir, name)).split("/");
    return caseDirs[caseDir] ?? caseDir;
  };
  const reported = new Set(fileResults.map((fileResult) => String(fileResult.name ?? "")));
  const pendingFiles = fileResults.flatMap((fileResult) => {
    const name = String(fileResult.name ?? "");
    const assertions = Array.isArray(fileResult.assertionResults) ? fileResult.assertionResults.filter(isRecord) : [];
    return isInside(copiesDir, name) && assertions.some((assertion) => assertion.status === "pending") ? [name] : [];
  });
  const incompleteCaseIds = [
    ...new Set([...expectedFiles.filter((file) => !reported.has(file)), ...pendingFiles].map(caseIdOfFile)),
  ];
  /** @type {Classified} */
  const initial = { byCase: {}, collectionErrors: {}, incompleteCaseIds };
  return fileResults.reduce(
    /** @param {Classified} acc @param {Record<string, unknown>} fileResult @returns {Classified} */
    (acc, fileResult) => {
      const name = typeof fileResult.name === "string" ? fileResult.name : "";
      if (!isInside(copiesDir, name)) {
        return acc;
      }
      const [, ...rest] = toPosix(path.relative(copiesDir, name)).split("/");
      const caseId = caseIdOfFile(name);
      const file = mineDisplay(rest.join("/"));
      const assertions = Array.isArray(fileResult.assertionResults)
        ? fileResult.assertionResults.filter(isRecord)
        : [];
      const failed = assertions
        .filter((assertion) => assertion.status === "failed")
        .map((assertion) => /** @type {Detection} */ ({
          mechanism: "tests",
          file,
          line: null,
          label: String(assertion.fullName ?? assertion.title ?? ""),
          message: Array.isArray(assertion.failureMessages)
            ? String(assertion.failureMessages[0] ?? "").split("\n")[0] ?? ""
            : "",
        }));
      const setupFailed =
        fileResult.status === "failed" && failed.length === 0
          ? [
              /** @type {Detection} */ ({
                mechanism: "tests",
                file,
                line: null,
                label: "読み込み、準備、後片付けのエラー",
                message: String(fileResult.message ?? "").split("\n")[0] ?? "",
              }),
            ]
          : [];
      return {
        ...acc,
        byCase: failed.length > 0 ? { ...acc.byCase, [caseId]: [...(acc.byCase[caseId] ?? []), ...failed] } : acc.byCase,
        collectionErrors:
          setupFailed.length > 0
            ? { ...acc.collectionErrors, [caseId]: [...(acc.collectionErrors[caseId] ?? []), ...setupFailed] }
            : acc.collectionErrors,
      };
    },
    initial,
  );
};
