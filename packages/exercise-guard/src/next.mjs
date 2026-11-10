import { mechanisms, mechanismNames } from "./model.mjs";

/** @typedef {import("./model.mjs").Detection} Detection */
/** @typedef {import("./model.mjs").Mechanism} Mechanism */
/** @typedef {import("./model.mjs").Problem} Problem */
/** @typedef {import("./model.mjs").Row} Row */

const maxSlipped = 3;
const peerCaseId = "R1-peer-change";

/**
 * @param {readonly Mechanism[]} list
 * @returns {string}
 */
const nameList = (list) =>
  `${list.map((mechanism) => mechanismNames[mechanism]).join("、")}${list.length > 1 ? "のどれか" : ""}`;

/**
 * @param {string} text
 * @returns {string}
 */
const firstLine = (text) => text.split("\n")[0] ?? "";

/**
 * @param {Detection} detection
 * @returns {string}
 */
const describeDetection = (detection) =>
  detection.mechanism === "lint"
    ? `ルール ${detection.label}、${detection.file}${detection.line === null ? "" : `:${detection.line}`}`
    : detection.mechanism === "types"
      ? `${detection.file}${detection.line === null ? "" : `:${detection.line}`} ${firstLine(detection.message)}`
      : `${detection.file} の「${detection.label}」`;

/**
 * @param {Row} row
 * @returns {readonly string[]}
 */
const falsePositiveSentences = (row) => {
  const byMechanism = mechanisms.flatMap((mechanism) => {
    const found = [...row.detections[mechanism], ...(mechanism === "types" ? row.builtinTypes : [])][0];
    const builtin = found !== undefined && row.builtinTypes[0] === found;
    return found === undefined
      ? []
      : [
          `正しいコード『${row.title}』を${builtin ? "もともとの型検査" : mechanismNames[mechanism]}が検出しました（${describeDetection(found)}）。${builtin ? "src の変更で正しいコードが型エラーになっていないか見直します。" : "ルールの対象を狭めるか、テストを見直します。"}`,
        ];
  });
  const loadErrors = row.collectionErrors.map(
    (detection) =>
      `正しいコード『${row.title}』のテストで、読み込みか準備か後片付けのエラーが出ました（${detection.file}${firstLine(detection.message) === "" ? "" : `: ${firstLine(detection.message)}`}）。テストの構文、import、beforeAll、afterAll を見直します。`,
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
    ? `『${row.title}』について、${offAllow.map((mechanism) => mechanismNames[mechanism]).join("、")}の検出はこの行では数えません。${nameList(row.allow)}で検出します。${hint}`
    : `『${row.title}』は検出されていません。${nameList(row.allow)}で検出します。${hint}`;
};

/**
 * @param {number} optionalRemaining
 * @returns {string}
 */
const passedSentence = (optionalRemaining) =>
  `必須の誤った変更はすべて検出しました。${optionalRemaining > 0 ? `任意の誤った変更の残り ${optionalRemaining} 件は、時間に余裕がある場合に取り組みます。` : ""}次へ進む前に、画面の表で行の題名の ▶ を押し、少なくとも 1 つの行に「この仕組みで検出できないこと」を 1 文で記入します。この記入は合格の条件ではありません。`;

/**
 * @param {Readonly<{ rows: readonly Row[], problems: readonly Problem[], stageOpened: number, passed: boolean, typesAllowed?: boolean }>} input
 * @returns {readonly string[]}
 */
export const buildNext = ({ rows, problems, stageOpened, passed, typesAllowed = true }) => {
  const fixes = [...new Set(problems.map((problem) => problem.fix))];
  const slipped = rows
    .filter((row) => row.kind === "bad" && row.id !== peerCaseId && row.verdict === "slipped")
    .sort((left, right) => Number(right.required) - Number(left.required))
    .slice(0, maxSlipped);
  const optionalRemaining = rows.filter(
    (row) => row.kind === "bad" && !row.required && row.id !== peerCaseId && (row.verdict === "slipped" || row.verdict === "undetermined"),
  ).length;
  const noAllowedDetection = rows.every(
    (row) => row.kind !== "bad" || mechanisms.every((mechanism) => !row.allow.includes(mechanism) || row.cells[mechanism].count === 0),
  );
  return [
    ...(passed ? [passedSentence(optionalRemaining)] : []),
    ...fixes,
    ...(noAllowedDetection && problems.length === 0
      ? [
          `まだ誤った変更を 1 件も検出できていません。誤った変更を 1 件選び、eslint.config.mjs の rules に Linter のルールを追加するか、exercises/guard/mine/ にある${typesAllowed ? "テストか型のテスト" : "テスト"}のファイルに書きます。`,
        ]
      : []),
    ...(stageOpened > 0 ? [`追加の誤った変更が ${stageOpened} 件増えました。`] : []),
    ...rows.filter((row) => row.verdict === "falsePositive").flatMap(falsePositiveSentences),
    ...slipped.map(slippedSentence),
  ];
};
