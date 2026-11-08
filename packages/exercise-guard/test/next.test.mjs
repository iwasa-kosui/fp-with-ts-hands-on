import { describe, expect, it } from "vitest";
import { buildNext } from "../src/next.mjs";

/** @typedef {import("../src/model.mjs").Detection} Detection */
/** @typedef {import("../src/model.mjs").Row} Row */

const noDetections = { types: [], lint: [], tests: [] };
/**
 * @param {import("../src/model.mjs").CellState} state
 * @param {number} count
 * @returns {import("../src/model.mjs").Cell}
 */
const cell = (state, count) => ({ state, count });

const noHit = cell("none", 0);

/**
 * @param {Partial<Row>} overrides
 * @returns {Row}
 */
const rowOf = (overrides) => ({
  id: "G1",
  kind: "good",
  title: "正しい parse",
  stage: 1,
  required: true,
  allow: [],
  hint: "",
  cells: { types: noHit, lint: noHit, tests: noHit },
  verdict: "falsePositive",
  detections: noDetections,
  builtinTypes: [],
  collectionErrors: [],
  ...overrides,
});

/**
 * @param {readonly Row[]} rows
 * @returns {readonly string[]}
 */
const nextOf = (rows) => buildNext({ rows, problems: [], noJudgedFiles: false, stageOpened: 0, passed: false });

/** @type {Detection} */
const typeError = {
  mechanism: "types",
  file: "mine/result.type-test.ts",
  line: 5,
  label: "TS2304",
  message: "名前 'x' が見つかりません。\n  詳細の行",
};

describe("buildNext", () => {
  it("型の検出は、ファイルと行のあとに原因の文を置き、TS の番号を出さない", () => {
    const [sentence] = nextOf([rowOf({ detections: { ...noDetections, types: [typeError] } })]);

    expect(sentence).toBe(
      "正しいコード『正しい parse』を型のテストが検出しました（mine/result.type-test.ts:5 名前 'x' が見つかりません。）。規則の対象を狭めるか、テストを見直します。",
    );
    expect(sentence).not.toContain("TS2304");
  });

  it("もともとの型検査の誤検知は、src の変更を見直す文にする", () => {
    const [sentence] = nextOf([rowOf({ builtinTypes: [{ ...typeError, file: "exercises/guard/cases/G1.ts" }] })]);

    expect(sentence).toContain("もともとの型検査が検出しました");
    expect(sentence).toContain("src の変更で正しいコードが型エラーになっていないか見直します。");
    expect(sentence).not.toContain("規則の対象を狭めるか");
  });

  it("テストの読み込み失敗は、vitest のメッセージの先頭の行を入れる", () => {
    const [sentence] = nextOf([
      rowOf({
        collectionErrors: [
          { mechanism: "tests", file: "mine/a.test.ts", line: null, label: "読み込み、準備、後片付けのエラー", message: "準備で失敗します" },
        ],
      }),
    ]);

    expect(sentence).toBe(
      "正しいコード『正しい parse』のテストで、読み込みか準備か後片付けのエラーが出ました（mine/a.test.ts: 準備で失敗します）。テストの構文、import、beforeAll、afterAll を見直します。",
    );
  });

  it("Linter の検出は規則名のまま示す", () => {
    const [sentence] = nextOf([
      rowOf({
        detections: {
          ...noDetections,
          lint: [{ mechanism: "lint", file: "exercises/guard/cases/G1.ts", line: 7, label: "no-restricted-syntax", message: "x" }],
        },
      }),
    ]);

    expect(sentence).toContain("規則 no-restricted-syntax、exercises/guard/cases/G1.ts:7");
  });

  it("allow に無い仕組みの検出は、この行では数えないと伝える", () => {
    const [sentence] = nextOf([
      rowOf({
        kind: "bad",
        verdict: "slipped",
        allow: ["tests"],
        hint: "テストで確かめます。",
        cells: { types: noHit, lint: cell("na", 2), tests: noHit },
      }),
    ]);

    expect(sentence).toBe(
      "『正しい parse』について、Linterの検出はこの行では数えません。テストで検出します。テストで確かめます。",
    );
  });

  it("判定対象のファイルが無く、allow の範囲の検出が 0 件なら、まだ悪い変更を 1 件も検出できていません", () => {
    const bad = rowOf({ kind: "bad", verdict: "slipped", allow: ["lint"] });
    const sentences = buildNext({ rows: [bad], problems: [], noJudgedFiles: true, stageOpened: 0, passed: false });

    expect(sentences.some((sentence) => sentence.startsWith("まだ悪い変更を 1 件も検出できていません"))).toBe(true);
  });

  it("allow の範囲で検出していれば、まだ悪い変更を 1 件も検出できていませんとは言わない", () => {
    const bad = rowOf({
      kind: "bad",
      verdict: "detected",
      allow: ["lint"],
      cells: { types: noHit, lint: cell("hit", 1), tests: noHit },
    });
    const sentences = buildNext({ rows: [bad], problems: [], noJudgedFiles: true, stageOpened: 0, passed: true });

    expect(sentences).toEqual(["合格です。次に、この仕組みで検出できないことを書きます。"]);
  });
});
