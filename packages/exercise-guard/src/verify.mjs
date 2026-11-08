import { existsSync } from "node:fs";
import path from "node:path";
import { judge } from "./judge.mjs";

/** @typedef {import("./model.mjs").GuardResult} GuardResult */
/** @typedef {Readonly<{ ok: boolean, line: string }>} Check */

const answerMineDir = "exercises/guard/answer/mine";
const answerEslintConfig = "exercises/guard/answer/eslint.config.mjs";
const verifyWorkDir = "dist/guard-verify";

/**
 * @param {readonly string[]} ids
 * @returns {string}
 */
const idList = (ids) => ids.join("、");

/**
 * @param {GuardResult} result
 * @returns {Check}
 */
export const checkInitial = (result) => {
  const bad = result.rows.filter((row) => row.kind === "bad");
  const good = result.rows.filter((row) => row.kind === "good");
  const detected = bad.filter((row) => row.verdict !== "slipped").map((row) => row.id);
  const falsePositives = good.filter((row) => row.verdict !== "noFalsePositive").map((row) => row.id);
  const reasons = [
    ...(detected.length > 0 ? [`配布時点で検出される悪い変更があります（${idList(detected)}）`] : []),
    ...(falsePositives.length > 0 ? [`配布時点で誤検知される正しいコードがあります（${idList(falsePositives)}）`] : []),
    ...result.problems.map((problem) => `問題があります（${problem}）`),
  ];
  return reasons.length === 0
    ? {
        ok: true,
        line: `OK 初期状態: 悪い変更 ${bad.length} 件はすべてすり抜け、正しいコード ${good.length} 件に誤検知はありません`,
      }
    : { ok: false, line: `NG 初期状態: ${reasons.join("。")}` };
};

/**
 * @param {GuardResult} result
 * @returns {Check}
 */
export const checkAnswer = (result) => {
  const bad = result.rows.filter((row) => row.kind === "bad");
  const good = result.rows.filter((row) => row.kind === "good");
  return result.passed
    ? {
        ok: true,
        line: `OK 模範: 合格しました（悪い変更 ${bad.length} 件を検出、正しいコード ${good.length} 件に誤検知なし）`,
      }
    : {
        ok: false,
        line: `NG 模範: 合格していません。${result.next[0] ?? result.problems[0] ?? ""}`,
      };
};

/**
 * @param {Readonly<{ root: string }>} options
 * @returns {Promise<Readonly<{ ok: boolean, lines: readonly string[] }>>}
 */
export const verify = async ({ root }) => {
  const rootDir = path.resolve(root);
  const initial = checkInitial(
    await judge({
      root: rootDir,
      mineDir: `${verifyWorkDir}/initial/mine`,
      workDir: `${verifyWorkDir}/initial`,
      revealAllStages: true,
    }),
  );
  const answer =
    existsSync(path.join(rootDir, answerMineDir)) && existsSync(path.join(rootDir, answerEslintConfig))
      ? checkAnswer(
          await judge({
            root: rootDir,
            mineDir: answerMineDir,
            eslintConfigFile: answerEslintConfig,
            workDir: `${verifyWorkDir}/answer`,
          }),
        )
      : {
          ok: false,
          line: `NG 模範: ${answerMineDir} と ${answerEslintConfig} がありません`,
        };
  return { ok: initial.ok && answer.ok, lines: [initial.line, answer.line] };
};
