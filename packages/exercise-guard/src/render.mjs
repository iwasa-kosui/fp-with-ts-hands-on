import { stringWidth, wrapByWidth } from "./text.mjs";

/** @typedef {import("./model.mjs").Cell} Cell */
/** @typedef {import("./model.mjs").GuardResult} GuardResult */
/** @typedef {import("./model.mjs").Row} Row */

const maxWidth = 78;
const cellsIndent = 6;
const red = (/** @type {string} */ line) => `\u001b[31m${line}\u001b[0m`;

/**
 * @param {Cell} cell
 * @returns {string}
 */
const cellText = (cell) =>
  cell.state === "hit"
    ? `検出 ${cell.count}件`
    : cell.state === "na"
      ? "対象外"
      : cell.state === "error"
        ? "エラー"
        : "−";

/**
 * @param {Row} row
 * @returns {string}
 */
const verdictText = (row) =>
  row.verdict === "detected"
    ? "検出"
    : row.verdict === "slipped"
      ? "未検出"
      : row.verdict === "unchanged"
        ? "未変更"
        : row.verdict === "undetermined"
          ? "未判定"
          : row.verdict === "falsePositive"
            ? "誤検知あり"
            : "誤検知なし";

/**
 * @param {Row} row
 * @returns {string}
 */
const cellsText = (row) =>
  `型のテスト ${cellText(row.cells.types)} / Linter ${cellText(row.cells.lint)} / テスト ${cellText(row.cells.tests)}`;

/**
 * @param {string} label
 * @param {readonly Row[]} rows
 * @param {boolean} color
 * @returns {readonly string[]}
 */
const renderSection = (label, rows, color) => [
  label,
  ...rows.flatMap((row) => {
    const prefix = `[${verdictText(row)}] `;
    const lines = [
      ...wrapByWidth(row.title, maxWidth - stringWidth(prefix)).map(
        (line, index) => (index === 0 ? prefix : " ".repeat(stringWidth(prefix))) + line,
      ),
      `${" ".repeat(cellsIndent)}${cellsText(row)}`,
    ];
    return color && row.verdict === "falsePositive" ? lines.map(red) : lines;
  }),
];

/**
 * @param {string} prefix
 * @param {string} text
 * @returns {readonly string[]}
 */
const wrapWithPrefix = (prefix, text) =>
  wrapByWidth(text, maxWidth - stringWidth(prefix)).map(
    (line, index) => (index === 0 ? prefix : " ".repeat(stringWidth(prefix))) + line,
  );

/**
 * @param {number} seconds
 * @returns {string}
 */
const secondsText = (seconds) => `${seconds.toFixed(1)}s`;

/**
 * @param {GuardResult} result
 * @returns {string}
 */
const headline = (result) => {
  const required = result.rows.filter((row) => row.kind === "bad" && row.required);
  const detected = required.filter((row) => row.verdict === "detected");
  return result.passed
    ? "結果: 合格です"
    : `結果: まだ合格していません（必須の誤った変更 ${required.length} 件のうち ${detected.length} 件を検出）`;
};

/**
 * @param {GuardResult} result
 * @param {Readonly<{ color: boolean }>} options
 * @returns {string}
 */
export const render = (result, { color }) => {
  const bad = result.rows.filter((row) => row.kind === "bad");
  const good = result.rows.filter((row) => row.kind === "good");
  const { durations } = result;
  return [
    ...wrapByWidth(headline(result), maxWidth),
    "",
    ...renderSection("誤った変更", bad, color),
    "",
    ...renderSection("正しいコード", good, color),
    "",
    "次にすること",
    ...result.next.flatMap((sentence, index) => wrapWithPrefix(`${index + 1}. `, sentence)),
    ...(result.problems.length > 0
      ? ["", "問題", ...result.problems.flatMap((problem) => wrapWithPrefix("- ", problem))]
      : []),
    ...(result.notes.length > 0
      ? ["", "補足", ...result.notes.flatMap((note) => wrapWithPrefix("- ", note))]
      : []),
    "",
    `所要: 型 ${secondsText(durations.types)} / Linter ${secondsText(durations.lint)} / テスト ${secondsText(durations.tests)} / 合計 ${secondsText(durations.total)}`,
    "",
  ].join("\n");
};
