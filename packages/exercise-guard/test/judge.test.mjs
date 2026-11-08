import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { judge } from "../src/judge.mjs";
import { render } from "../src/render.mjs";
import { stringWidth } from "../src/text.mjs";
import { verify } from "../src/verify.mjs";

/** @typedef {import("../src/model.mjs").GuardResult} GuardResult */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "fixtures", "s03");
const scenarios = path.join(here, "fixtures", "s03-scenarios");
const originalCwd = process.cwd();

/** @type {Map<string, Promise<GuardResult>>} */
const cache = new Map();

/**
 * @param {string} name
 * @returns {Promise<GuardResult>}
 */
const scenario = (name) => {
  const cached = cache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const started = judge({
    root,
    mineDir: path.join(scenarios, name, "mine"),
    eslintConfigFile: path.join(scenarios, name, "eslint.config.mjs"),
    workDir: `dist/guard-${name}`,
  });
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
    expect(result.next[0]).toContain("まだ仕組みがありません");
  });

  it("pass: 参加者が足した仕組みですべて検出し、誤検知が無ければ合格する", async () => {
    const result = await scenario("pass");

    expect(result.passed).toBe(true);
    expect(result.rows).toHaveLength(7);
    expect(result.hiddenCount).toBe(0);
    expect(result.problems).toEqual([]);
    expect(rowOf(result, "B5-any-result").cells.types.state).toBe("hit");
    expect(result.next).toEqual(["合格です。表の行を開いて、この仕組みで検出できないことを書きます。"]);
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
    expect(result.next.some((sentence) => sentence.includes("でも検出していますが"))).toBe(true);
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
