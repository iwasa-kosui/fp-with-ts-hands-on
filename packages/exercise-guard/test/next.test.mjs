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

const detectedBad = rowOf({
  id: "B0",
  kind: "bad",
  verdict: "detected",
  allow: ["lint"],
  cells: { types: noHit, lint: cell("hit", 1), tests: noHit },
});

/**
 * @param {readonly Row[]} rows
 * @returns {readonly string[]}
 */
const nextOf = (rows) => buildNext({ rows: [...rows, detectedBad], problems: [], stageOpened: 0, passed: false });

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
      "正しいコード『正しい parse』を型のテストが検出しました（mine/result.type-test.ts:5 名前 'x' が見つかりません。）。ルールの対象を狭めるか、テストを見直します。",
    );
    expect(sentence).not.toContain("TS2304");
  });

  it("もともとの型検査の誤検知は、src の変更を見直す文にする", () => {
    const [sentence] = nextOf([rowOf({ builtinTypes: [{ ...typeError, file: "exercises/guard/cases/G1.ts" }] })]);

    expect(sentence).toContain("もともとの型検査が検出しました");
    expect(sentence).toContain("src の変更で正しいコードが型エラーになっていないか見直します。");
    expect(sentence).not.toContain("ルールの対象を狭めるか");
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

  it("Linter の検出はルール名のまま示す", () => {
    const [sentence] = nextOf([
      rowOf({
        detections: {
          ...noDetections,
          lint: [{ mechanism: "lint", file: "exercises/guard/cases/G1.ts", line: 7, label: "no-restricted-syntax", message: "x" }],
        },
      }),
    ]);

    expect(sentence).toContain("ルール no-restricted-syntax、exercises/guard/cases/G1.ts:7");
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

  it("allow の範囲の検出が 0 件で問題も無ければ、まだ誤った変更を 1 件も検出できていません", () => {
    const bad = rowOf({ kind: "bad", verdict: "slipped", allow: ["lint"] });
    const sentences = buildNext({ rows: [bad], problems: [], stageOpened: 0, passed: false });

    expect(sentences.some((sentence) => sentence.startsWith("まだ誤った変更を 1 件も検出できていません"))).toBe(true);
  });

  it("allow の範囲に検出が 1 件でもあれば、合格でなくてもまだ誤った変更を 1 件も検出できていませんとは言わない", () => {
    const bad = rowOf({ id: "B2", kind: "bad", verdict: "slipped", allow: ["lint"] });
    const sentences = buildNext({ rows: [detectedBad, bad], problems: [], stageOpened: 0, passed: false });

    expect(sentences.some((sentence) => sentence.startsWith("まだ誤った変更を 1 件も検出できていません"))).toBe(false);
  });

  it("allow の範囲で検出していれば、まだ誤った変更を 1 件も検出できていませんとは言わない", () => {
    const bad = rowOf({
      kind: "bad",
      verdict: "detected",
      allow: ["lint"],
      cells: { types: noHit, lint: cell("hit", 1), tests: noHit },
    });
    const sentences = buildNext({ rows: [bad], problems: [], stageOpened: 0, passed: true });

    expect(sentences).toEqual(["必須の誤った変更はすべて検出しました。画面の表で行の題名の ▶ を押し、少なくとも 1 つの行に「この仕組みで検出できないこと」を 1 文で記入します。"]);
  });

  it("合格のときは、未変更の任意の行を残りの件数に数えない", () => {
    const unchanged = rowOf({ id: "R1-peer-change", kind: "bad", verdict: "unchanged", required: false, allow: ["tests"] });
    const sentences = buildNext({ rows: [detectedBad, unchanged], problems: [], stageOpened: 0, passed: true });

    expect(sentences[0]).toBe("必須の誤った変更はすべて検出しました。画面の表で行の題名の ▶ を押し、少なくとも 1 つの行に「この仕組みで検出できないこと」を 1 文で記入します。");
  });

  it("合格のときは、相互レビューの行が未検出でも、任意の残りの件数に数えない", () => {
    const peer = rowOf({ id: "R1-peer-change", kind: "bad", verdict: "slipped", required: false, allow: ["tests"] });
    const sentences = buildNext({ rows: [detectedBad, peer], problems: [], stageOpened: 0, passed: true });

    expect(sentences[0]).toBe("必須の誤った変更はすべて検出しました。画面の表で行の題名の ▶ を押し、少なくとも 1 つの行に「この仕組みで検出できないこと」を 1 文で記入します。");
  });

  it("合格のときは、任意の誤った変更が検出されていなくても、合格の文を先頭に置く", () => {
    const optional = rowOf({
      kind: "bad",
      verdict: "slipped",
      required: false,
      title: "相互レビューで作る誤った変更",
      allow: ["tests"],
    });
    const sentences = buildNext({ rows: [detectedBad, optional], problems: [], stageOpened: 0, passed: true });

    expect(sentences[0]).toBe("必須の誤った変更はすべて検出しました。任意の誤った変更の残り 1 件は、時間に余裕がある場合に取り組みます。画面の表で行の題名の ▶ を押し、少なくとも 1 つの行に「この仕組みで検出できないこと」を 1 文で記入します。");
    expect(sentences[1]).toContain("『相互レビューで作る誤った変更』は検出されていません。");
  });

  describe("まだ 1 件も検出できていないときの案内", () => {
    /** @param {boolean} typesAllowed */
    const undetected = (typesAllowed) =>
      buildNext({
        rows: [rowOf({ id: "B0", kind: "bad", verdict: "slipped", allow: ["lint", "tests"], cells: { types: noHit, lint: noHit, tests: noHit } })],
        problems: [],
        stageOpened: 0,
        passed: false,
        typesAllowed,
      })[0];

    it("設定の allow に types がある演習では、型のテストのファイルにも触れる", () => {
      expect(undetected(true)).toBe(
        "まだ誤った変更を 1 件も検出できていません。誤った変更を 1 件選び、eslint.config.mjs の rules に Linter のルールを追加するか、exercises/guard/mine/ にあるテストか型のテストのファイルに書きます。",
      );
    });

    it("設定の allow に types が無い演習では、型のテストに触れない", () => {
      expect(undetected(false)).toBe(
        "まだ誤った変更を 1 件も検出できていません。誤った変更を 1 件選び、eslint.config.mjs の rules に Linter のルールを追加するか、exercises/guard/mine/ にあるテストのファイルに書きます。",
      );
    });
  });
});
