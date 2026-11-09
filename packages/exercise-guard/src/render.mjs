import { padEndWidth, stringWidth, wrapByWidth } from "./text.mjs";

/** @typedef {import("./model.mjs").Cell} Cell */
/** @typedef {import("./model.mjs").GuardResult} GuardResult */
/** @typedef {import("./model.mjs").Row} Row */

const maxWidth = 78;
const separator = " | ";
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
      ? "すり抜け"
      : row.verdict === "unchanged"
        ? "未変更"
        : row.verdict === "falsePositive"
          ? "誤検知あり"
          : "誤検知なし";

/**
 * @param {Row} row
 * @returns {readonly string[]}
 */
const bodyCells = (row) => [
  row.title,
  cellText(row.cells.types),
  cellText(row.cells.lint),
  cellText(row.cells.tests),
  verdictText(row),
];

/**
 * @param {readonly (readonly string[])[]} tables
 * @returns {readonly number[]}
 */
const columnWidths = (tables) => {
  const fixed = [1, 2, 3, 4].map((index) =>
    Math.max(...tables.map((cells) => stringWidth(cells[index] ?? ""))),
  );
  const natural = Math.max(...tables.map((cells) => stringWidth(cells[0] ?? "")));
  return [
    Math.min(natural, maxWidth - fixed.reduce((sum, width) => sum + width, 0) - separator.length * 4),
    ...fixed,
  ];
};

/**
 * @param {string} label
 * @param {readonly Row[]} rows
 * @param {readonly number[]} widths
 * @param {boolean} color
 * @returns {readonly string[]}
 */
const renderTable = (label, rows, widths, color) => {
  /** @param {readonly string[]} cells @returns {string} */
  const line = (cells) =>
    cells
      .map((cell, index) => padEndWidth(cell, widths[index] ?? 0))
      .join(separator)
      .trimEnd();
  const rowLines = rows.flatMap((row) => {
    const cells = bodyCells(row);
    const lines = wrapByWidth(row.title, widths[0] ?? 0).map((title, lineIndex) =>
      line(lineIndex === 0 ? [title, ...cells.slice(1)] : [title, "", "", "", ""]),
    );
    return color && row.verdict === "falsePositive" ? lines.map(red) : lines;
  });
  return [
    line([label, "型のテスト", "Linter", "テスト", "結果"]),
    widths.map((width) => "-".repeat(width)).join("-+-"),
    ...rowLines,
  ];
};

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
  const widths = columnWidths([
    ["誤った変更", "型のテスト", "Linter", "テスト", "結果"],
    ["正しいコード", "", "", "", ""],
    ...result.rows.map(bodyCells),
  ]);
  return [
    ...wrapByWidth(headline(result), maxWidth),
    "",
    ...renderTable("誤った変更", bad, widths, color),
    "",
    ...renderTable("正しいコード", good, widths, color),
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
