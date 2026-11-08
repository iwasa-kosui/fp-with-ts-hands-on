import { mechanisms, mechanismNames } from "./model.mjs";

/** @typedef {import("./model.mjs").Detection} Detection */
/** @typedef {import("./model.mjs").Mechanism} Mechanism */
/** @typedef {import("./model.mjs").Problem} Problem */
/** @typedef {import("./model.mjs").Row} Row */

const maxSlipped = 3;

/**
 * @param {readonly Mechanism[]} list
 * @returns {string}
 */
const nameList = (list) =>
  `${list.map((mechanism) => mechanismNames[mechanism]).join("、")}${list.length > 1 ? "のどれか" : ""}`;

/**
 * @param {Detection} detection
 * @returns {string}
 */
const describeDetection = (detection) =>
  detection.mechanism === "lint"
    ? `規則 ${detection.label}、${detection.file}${detection.line === null ? "" : `:${detection.line}`}`
    : detection.mechanism === "types"
      ? `${detection.file}${detection.line === null ? "" : `:${detection.line}`} ${detection.label}`
      : `${detection.file} の「${detection.label}」`;

/**
 * @param {Row} row
 * @returns {readonly string[]}
 */
const falsePositiveSentences = (row) => {
  const tail = "規則の対象を狭めるか、テストを見直します。";
  const byMechanism = mechanisms.flatMap((mechanism) => {
    const found = [...row.detections[mechanism], ...(mechanism === "types" ? row.builtinTypes : [])][0];
    return found === undefined
      ? []
      : [
          `正しいコード『${row.title}』を${row.builtinTypes[0] === found ? "もともとの型検査" : mechanismNames[mechanism]}が検出しました（${describeDetection(found)}）。${tail}`,
        ];
  });
  const loadErrors = row.collectionErrors.map(
    (detection) =>
      `正しいコード『${row.title}』のテストを読み込めませんでした（${detection.file}）。テストの構文と import を見直します。`,
  );
  return [...byMechanism, ...loadErrors];
};

/**
 * @param {Row} row
 * @returns {string}
 */
const slippedSentence = (row) => {
  const offAllow = mechanisms.filter(
    (mechanism) => row.cells[mechanism].state === "na" && row.cells[mechanism].count > 0,
  );
  const hint = row.hint === "" ? "" : row.hint;
  return offAllow.length > 0
    ? `『${row.title}』を${nameList(offAllow)}でも検出していますが、この悪い変更は${nameList(row.allow)}で検出します。${hint}`
    : `『${row.title}』がすり抜けています。${nameList(row.allow)}で検出します。${hint}`;
};

/**
 * @param {Readonly<{ rows: readonly Row[], problems: readonly Problem[], mineEmpty: boolean, ruleCount: number | null, stageOpened: number, passed: boolean }>} input
 * @returns {readonly string[]}
 */
export const buildNext = ({ rows, problems, mineEmpty, ruleCount, stageOpened, passed }) => {
  const fixes = [...new Set(problems.map((problem) => problem.fix))];
  const slipped = rows
    .filter((row) => row.kind === "bad" && row.verdict === "slipped")
    .sort((left, right) => Number(right.required) - Number(left.required))
    .slice(0, maxSlipped);
  return [
    ...fixes,
    ...(mineEmpty && ruleCount === 0
      ? [
          "まだ仕組みがありません。悪い変更を 1 件選び、eslint.config.mjs の rules に規則を足すか、exercises/guard/mine/ にテストか型のテストを足します。",
        ]
      : []),
    ...(stageOpened > 0 ? [`追加の悪い変更が ${stageOpened} 件増えました。`] : []),
    ...rows.filter((row) => row.verdict === "falsePositive").flatMap(falsePositiveSentences),
    ...slipped.map(slippedSentence),
    ...(passed ? ["合格です。表の行を開いて、この仕組みで検出できないことを書きます。"] : []),
  ];
};
