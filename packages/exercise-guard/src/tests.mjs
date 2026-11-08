import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isInside, toPosix } from "./paths.mjs";

/** @typedef {import("./model.mjs").Detection} Detection */
/** @typedef {import("./model.mjs").Problem} Problem */
/** @typedef {Readonly<{ status: "ok" | "timeout" | "spawn-failed", stderrTail: string }>} VitestExit */
/** @typedef {Readonly<Record<string, readonly Detection[]>>} ByCase */
/** @typedef {Readonly<{ byCase: ByCase, collectionErrors: ByCase }>} Classified */

export const vitestTimeoutMs = 60_000;

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
 * @param {Readonly<{ root: string, workDir: string }>} paths
 * @returns {string}
 */
export const buildVitestConfig = ({ root, workDir }) =>
  `export default ${JSON.stringify(
    {
      root,
      test: {
        include: [`${toPosix(path.relative(root, workDir))}/copies/**/*.test.ts`],
        exclude: ["**/node_modules/**"],
        pool: "forks",
        poolOptions: { forks: { singleFork: true, isolate: false } },
        testTimeout: 5000,
      },
    },
    null,
    2,
  )};\n`;

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
 * @param {Readonly<{ root: string, vitestFile: string, configFile: string, outputFile: string }>} input
 * @returns {Promise<VitestExit>}
 */
export const runVitest = ({ root, vitestFile, configFile, outputFile }) =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [vitestFile, "run", "--config", configFile, "--reporter=json", `--outputFile=${outputFile}`],
      { cwd: root, env: vitestEnv(process.env), stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks = /** @type {string[]} */ ([]);
    const collect = (/** @type {Buffer} */ chunk) => {
      chunks.push(String(chunk));
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const tail = () => chunks.join("").slice(-400);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ status: "timeout", stderrTail: tail() });
    }, vitestTimeoutMs);
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
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === "object" && value !== null;

/**
 * @param {unknown} json
 * @param {Readonly<{ copiesDir: string, mineDisplay: (rel: string) => string }>} context
 * @returns {Classified | undefined}
 */
export const classifyVitest = (json, { copiesDir, mineDisplay }) => {
  if (!isRecord(json) || !Array.isArray(json.testResults)) {
    return undefined;
  }
  /** @type {Classified} */
  const initial = { byCase: {}, collectionErrors: {} };
  return json.testResults.filter(isRecord).reduce(
    /** @param {Classified} acc @param {Record<string, unknown>} fileResult @returns {Classified} */
    (acc, fileResult) => {
      const name = typeof fileResult.name === "string" ? fileResult.name : "";
      if (!isInside(copiesDir, name)) {
        return acc;
      }
      const [caseId = "", ...rest] = toPosix(path.relative(copiesDir, name)).split("/");
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
      const loadFailed =
        fileResult.status === "failed" && assertions.length === 0
          ? [
              /** @type {Detection} */ ({
                mechanism: "tests",
                file,
                line: null,
                label: "読み込み失敗",
                message: String(fileResult.message ?? "").split("\n")[0] ?? "",
              }),
            ]
          : [];
      return {
        byCase: failed.length > 0 ? { ...acc.byCase, [caseId]: [...(acc.byCase[caseId] ?? []), ...failed] } : acc.byCase,
        collectionErrors:
          loadFailed.length > 0
            ? { ...acc.collectionErrors, [caseId]: [...(acc.collectionErrors[caseId] ?? []), ...loadFailed] }
            : acc.collectionErrors,
      };
    },
    initial,
  );
};
