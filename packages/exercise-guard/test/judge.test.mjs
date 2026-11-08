import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { judge } from "../src/judge.mjs";
import { render } from "../src/render.mjs";
import { stringWidth } from "../src/text.mjs";
import { verify } from "../src/verify.mjs";
import { groupGone } from "./process-group.mjs";

/** @typedef {import("../src/model.mjs").GuardResult} GuardResult */
/** @typedef {Partial<Pick<import("../src/judge.mjs").JudgeOptions, "testTimeoutMs" | "isolate" | "onVitestSpawn">>} RunExtras */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "fixtures", "s03");
const scenarios = path.join(here, "fixtures", "s03-scenarios");
const originalCwd = process.cwd();

/** @type {Map<string, Promise<GuardResult>>} */
const cache = new Map();

/**
 * @param {string} name
 * @param {RunExtras} [extras]
 * @returns {Promise<GuardResult>}
 */
const runScenario = (name, extras = {}) =>
  judge({
    root,
    mineDir: path.join(scenarios, name, "mine"),
    eslintConfigFile: path.join(scenarios, name, "eslint.config.mjs"),
    workDir: `dist/guard-${name}`,
    ...extras,
  });

/**
 * @param {string} name
 * @returns {Promise<GuardResult>}
 */
const scenario = (name) => {
  const cached = cache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const started = runScenario(name);
  cache.set(name, started);
  return started;
};

/**
 * @param {GuardResult} result
 * @param {string} id
 * @returns {GuardResult["rows"][number]}
 */
const rowOf = (result, id) => {
  const row = result.rows.find((candidate) => candidate.id === id);
  if (row === undefined) {
    throw new Error(`行がありません: ${id}`);
  }
  return row;
};

const stageOneBad = [
  "B1-any-parser",
  "B2-unknown-cast",
  "B3-schema-without-uuid",
  "B4-handler-bypasses-parse",
];

beforeAll(() => {
  process.chdir(root);
});

afterAll(() => {
  process.chdir(originalCwd);
});

describe("judge", () => {
  it("empty: 配布済みテストがあっても、仕組みが無ければ全部すり抜ける", async () => {
    const result = await scenario("empty");

    expect(result.passed).toBe(false);
    expect(result.rows.filter((row) => row.kind === "bad").map((row) => row.id)).toEqual(stageOneBad);
    expect(result.rows.filter((row) => row.kind === "bad").every((row) => row.verdict === "slipped")).toBe(true);
    expect(result.rows.filter((row) => row.kind === "good").every((row) => row.verdict === "noFalsePositive")).toBe(true);
    expect(result.hiddenCount).toBe(1);
    expect(result.next[0]).toContain("まだ悪い変更を 1 件も検出できていません");
  });

  it("pass: 参加者が足した仕組みですべて検出し、誤検知が無ければ合格する", async () => {
    const result = await scenario("pass");

    expect(result.passed).toBe(true);
    expect(result.rows).toHaveLength(7);
    expect(result.hiddenCount).toBe(0);
    expect(result.problems).toEqual([]);
    expect(rowOf(result, "B5-any-result").cells.types.state).toBe("hit");
    expect(result.next).toEqual(["合格です。次に、この仕組みで検出できないことを書きます。"]);
    expect(result.durations.total).toBeGreaterThan(0);
  });

  it("pass: 未使用の @ts-expect-error の検出は日本語の文言になる", async () => {
    const result = await scenario("pass");

    expect(rowOf(result, "B5-any-result").detections.types.map((detection) => detection.message)).toEqual([
      "この @ts-expect-error の次の行に、型のエラーが出ませんでした",
    ]);
  });

  it("pass: result.json に同じ結果を書く", async () => {
    const result = await scenario("pass");
    const written = JSON.parse(readFileSync(path.join(root, "dist/guard-pass/result.json"), "utf8"));

    expect(written).toEqual(JSON.parse(JSON.stringify(result)));
    expect(written.version).toBe(1);
  });

  it("miss-one: B3 を検出するテストが無ければ B3 だけすり抜ける", async () => {
    const result = await scenario("miss-one");

    expect(result.passed).toBe(false);
    expect(result.rows.filter((row) => row.verdict === "slipped").map((row) => row.id)).toEqual([
      "B3-schema-without-uuid",
    ]);
    expect(result.hiddenCount).toBe(1);
  });

  it("false-positive: 正しいコードに当たる規則は誤検知として規則名を示す", async () => {
    const result = await scenario("false-positive");
    const good = rowOf(result, "G1-solution");

    expect(result.passed).toBe(false);
    expect(result.next).toContain(
      "正しいコード『正しい parse』をLinterが検出しました（規則 no-restricted-syntax、exercises/guard/cases/G1-solution.ts:7）。規則の対象を狭めるか、テストを見直します。",
    );
    expect(good.verdict).toBe("falsePositive");
    expect(good.detections.lint.map((detection) => detection.label)).toContain("no-restricted-syntax");
    expect(result.next.some((sentence) => sentence.includes("no-restricted-syntax"))).toBe(true);
    expect(rowOf(result, "G2-handler-uses-parse").verdict).toBe("noFalsePositive");
  });

  it("stage: 型のテストが無いと stage 2 の B5 が見えてすり抜ける", async () => {
    const result = await scenario("no-type-test");

    expect(result.passed).toBe(false);
    expect(result.hiddenCount).toBe(0);
    expect(rowOf(result, "B5-any-result").verdict).toBe("slipped");
    expect(rowOf(result, "B5-any-result").cells.lint.state).toBe("na");
    expect(result.next[0]).toBe("追加の悪い変更が 1 件増えました。");
  });

  it("na-only: allow に無い仕組みの検出は対象外で、検出に数えない", async () => {
    const result = await scenario("na-only");
    const b3 = rowOf(result, "B3-schema-without-uuid");

    expect(b3.verdict).toBe("slipped");
    expect(b3.cells.lint.state).toBe("na");
    expect(b3.cells.lint.count).toBeGreaterThan(0);
    expect(result.next.some((sentence) => sentence.includes("の検出はこの行では数えません"))).toBe(true);
  });

  it("broken-config: 設定を読み込めなくても判定は続き、Linter の列がエラーになる", async () => {
    const result = await scenario("broken-config");

    expect(result.passed).toBe(false);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(rowOf(result, "B1-any-parser").cells.lint.state).toBe("error");
    expect(rowOf(result, "B3-schema-without-uuid").cells.tests.state).toBe("hit");
  });

  it("broken-test: 読み込めないテストは検出に数えず、正しいコードの誤検知にする", async () => {
    const result = await scenario("broken-test");
    const good = rowOf(result, "G1-solution");

    expect(result.passed).toBe(false);
    expect(good.verdict).toBe("falsePositive");
    expect(good.collectionErrors).toHaveLength(1);
    expect(
      result.rows.every((row) =>
        row.detections.tests.every((detection) => !detection.file.endsWith("broken.test.ts")),
      ),
    ).toBe(true);
  });

  it("unjudged: 題材を import しないテストは判定に使わず、notes に載せる", async () => {
    const result = await scenario("unjudged");

    expect(result.passed).toBe(false);
    expect(result.notes.some((note) => note.includes("unrelated.test.ts"))).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.rows.every((row) => row.detections.tests.length === 0)).toBe(true);
  });

  it("empty: 仕組みが無いときの次にすることの全文", async () => {
    const result = await scenario("empty");

    expect(result.next[0]).toBe(
      "まだ悪い変更を 1 件も検出できていません。悪い変更を 1 件選び、eslint.config.mjs の rules に規則を足すか、exercises/guard/mine/ にテストか型のテストを足します。",
    );
  });

  it("only-type-test: 型のテストだけなら vitest を起動せず、テストの列はエラーにならない", async () => {
    const result = await scenario("only-type-test");

    expect(result.problems).toEqual([]);
    expect(result.rows.every((row) => row.cells.tests.state !== "error")).toBe(true);
    expect(result.durations.tests).toBe(0);
  });

  it("worker-crash: ワーカーが途中で落ちたら、未実行のケースを示して不合格にする", async () => {
    const result = await scenario("worker-crash");

    expect(result.passed).toBe(false);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.problems[0]).toContain("テストの実行が途中で終わりました");
    expect(result.problems[0]).toMatch(/実行されなかったケースが \d+ 件あります。/);
    expect(result.problems[0]).not.toContain("正しい parse");
  });

  it("target-by-name: ファイル名で悪い変更だけを狙う規則は不合格にする", async () => {
    const result = await scenario("target-by-name");

    expect(result.passed).toBe(false);
    expect(result.problems.some((problem) => problem.includes("eslint.config.mjs の規則がケースによって違います（"))).toBe(true);
    expect(result.problems.some((problem) => problem.includes("規則をファイル名で分けずに"))).toBe(false);
    expect(result.next).toContain("規則をファイル名で分けずに、コードの形で検出します。");
  });

  it("既存のシナリオの eslint.config.mjs は、全ケースに同じ規則を当てる", async () => {
    const names = ["empty", "pass", "miss-one", "false-positive", "no-type-test", "na-only", "broken-test", "unjudged"];
    const results = await Promise.all(names.map(scenario));

    expect(
      results.flatMap((result) => result.problems.filter((problem) => problem.includes("ファイル名で分けず"))),
    ).toEqual([]);
  });

  it("before-all-fails: 準備で失敗するテストは、正しいコードの誤検知にする", async () => {
    const result = await scenario("before-all-fails");
    const good = rowOf(result, "G1-solution");

    expect(good.verdict).toBe("falsePositive");
    expect(good.collectionErrors).toHaveLength(1);
    expect(good.cells.tests.state).toBe("error");
    expect(
      result.next.some((sentence) => sentence.includes("読み込みか準備か後片付けのエラー") && sentence.includes("準備で失敗します")),
    ).toBe(true);
  });

  it("shared-helper: 題材を import するヘルパーを経由するテストも、誤検知にならない", async () => {
    const result = await scenario("shared-helper");

    expect(result.problems).toEqual([]);
    expect(result.rows.filter((row) => row.kind === "good").every((row) => row.verdict === "noFalsePositive")).toBe(true);
    expect(rowOf(result, "G2-handler-uses-parse").collectionErrors).toEqual([]);
    expect(rowOf(result, "G2-handler-uses-parse").detections.types).toEqual([]);
  });

  it("rule-throws: 規則の実行中の例外は、規則名を示す", async () => {
    const result = await scenario("rule-throws");

    expect(result.passed).toBe(false);
    expect(result.problems[0]).toContain("規則 local/explodes の実行中にエラーが出ました");
    expect(result.next).toContain("規則 local/explodes の書き方を見直します。");
    expect(result.problems.join("\n")).not.toContain("読み込めませんでした");
    expect(result.next.some((sentence) => sentence.includes("まだ悪い変更を 1 件も検出できていません"))).toBe(false);
  });

  it("broken-config: 規則名が取れない例外は、設定を読み込めなかった扱いのまま", async () => {
    const result = await scenario("broken-config");

    expect(result.problems[0]).toContain("eslint.config.mjs を読み込めませんでした");
  });

  it("test-hangs: 終わらないテストは打ち切り、プロセスのグループを残さない", async () => {
    const pids = /** @type {number[]} */ ([]);
    const result = await runScenario("test-hangs", {
      testTimeoutMs: 8000,
      onVitestSpawn: (pid) => {
        pids.push(pid);
      },
    });

    expect(result.passed).toBe(false);
    expect(result.problems).toContain("テストが 8 秒で終わりませんでした。");
    expect(result.next).toContain("テストの中に終わらない繰り返しや、待ち続ける処理がないか見直します。");
    expect(pids).toHaveLength(1);
    expect(await Promise.all(pids.map(groupGone))).toEqual([true]);
  });

  it("state-leak: 既定の設定でも、ケースの間でモジュールの状態と globalThis のキーが漏れない", async () => {
    const result = await scenario("state-leak");

    expect(rowOf(result, "G1-solution").verdict).toBe("noFalsePositive");
    expect(rowOf(result, "G1-solution").detections.tests).toEqual([]);
    expect(rowOf(result, "G1-solution").collectionErrors).toEqual([]);
  });

  it("state-leak: isolate を true にしても、ケースの間で状態が漏れない", async () => {
    const result = await runScenario("state-leak", { isolate: true });

    expect(rowOf(result, "G1-solution").verdict).toBe("noFalsePositive");
    expect(rowOf(result, "G1-solution").detections.tests).toEqual([]);
  });

  it("module-mock: テストファイルのトップレベルの vi.fn は、他のケースの実行で戻されても誤検知にならない", async () => {
    const result = await scenario("module-mock");

    expect(result.problems).toEqual([]);
    expect(result.rows.filter((row) => row.kind === "good").every((row) => row.verdict === "noFalsePositive")).toBe(true);
    expect(rowOf(result, "G1-solution").collectionErrors).toEqual([]);
    expect(rowOf(result, "G1-solution").detections.tests).toEqual([]);
  });

  it("unjudged: 題材を import しないテストの補足に、import する題材を示す", async () => {
    const result = await scenario("unjudged");

    expect(result.notes[0]).toContain("exercises/guard/subjects/input.ts");
    expect(result.notes[0]).toContain("exercises/guard/subjects/handler.ts");
    expect(result.next[0]).toContain("まだ悪い変更を 1 件も検出できていません");
  });

  it("spec-file: *.spec.ts は実行せず、補足に出す", async () => {
    const result = await scenario("spec-file");

    expect(result.notes.some((note) => note.includes("input.spec.ts は実行しません。テストのファイル名は *.test.ts にします。"))).toBe(true);
  });

  it("verify: 配布時点ですり抜け、模範で合格する", async () => {
    const result = await verify({ root });

    expect(result.lines).toHaveLength(2);
    expect(result.ok, result.lines.join("\n")).toBe(true);
    expect(existsSync(path.join(root, "dist/guard-verify/answer/result.json"))).toBe(true);
  });
});

describe("render", () => {
  it("78 桁以内で、止まったという言い方を使わない", async () => {
    const text = render(await scenario("empty"), { color: false });

    expect(text).toContain("すり抜け");
    expect(text).toContain("検査の結果: まだ合格していません（必須の悪い変更 4 件のうち 0 件を検出）");
    expect(text).not.toMatch(/止ま|止め|実行できない/);
    expect(Math.max(...text.split("\n").map(stringWidth))).toBeLessThanOrEqual(78);
  });

  it("行頭に句読点や閉じ括弧が来ない", async () => {
    const text = render(await scenario("empty"), { color: false });

    expect(text.split("\n").filter((line) => /^\s*[。、）」』]/.test(line))).toEqual([]);
  });

  it("合格の表示", async () => {
    const text = render(await scenario("pass"), { color: false });

    expect(text.split("\n")[0]).toBe("検査の結果: 合格です");
    expect(text).toContain("次にすること");
    expect(text).toMatch(/所要: 型 [\d.]+s \/ Linter [\d.]+s \/ テスト [\d.]+s \/ 合計 [\d.]+s/);
  });

  it("color のときだけ誤検知の行を赤にする", async () => {
    const result = await scenario("false-positive");

    expect(render(result, { color: true })).toContain("\u001b[31m");
    expect(render(result, { color: false })).not.toContain("\u001b");
  });
});
