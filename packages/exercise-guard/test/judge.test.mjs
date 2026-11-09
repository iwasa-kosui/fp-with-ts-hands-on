import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const copiedRoots = path.join(here, "fixtures", "dist");

/**
 * @param {string} name
 * @returns {string}
 */
const copyRoot = (name) => {
  const copied = path.join(copiedRoots, name);
  rmSync(copied, { recursive: true, force: true });
  mkdirSync(copiedRoots, { recursive: true });
  cpSync(root, copied, { recursive: true, filter: (source) => path.relative(root, source).split(path.sep)[0] !== "dist" });
  return copied;
};

/**
 * @param {string} copied
 * @param {readonly string[]} names
 * @returns {void}
 */
const placeAnswerTests = (copied, names) => {
  names.forEach((name) => {
    writeFileSync(
      path.join(copied, "exercises/guard/mine", name),
      readFileSync(path.join(copied, "exercises/guard/answer/mine", name), "utf8").replaceAll("../../subjects/", "../subjects/"),
    );
  });
};

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
  ["verify-detecting-mine", "unchanged-root"].forEach((name) => {
    rmSync(path.join(copiedRoots, name), { recursive: true, force: true });
  });
});

describe("judge", () => {
  it("empty: 配布済みテストがあっても、仕組みが無ければ全部検出されない", async () => {
    const result = await scenario("empty");

    expect(result.passed).toBe(false);
    expect(result.rows.filter((row) => row.kind === "bad").map((row) => row.id)).toEqual(stageOneBad);
    expect(result.rows.filter((row) => row.kind === "bad").every((row) => row.verdict === "slipped")).toBe(true);
    expect(result.rows.filter((row) => row.kind === "good").every((row) => row.verdict === "noFalsePositive")).toBe(true);
    expect(result.hiddenCount).toBe(1);
    expect(result.next[0]).toContain("まだ誤った変更を 1 件も検出できていません");
  });

  it("pass: 参加者が足した仕組みですべて検出し、誤検知が無ければ合格する", async () => {
    const result = await scenario("pass");

    expect(result.passed).toBe(true);
    expect(result.rows).toHaveLength(7);
    expect(result.hiddenCount).toBe(0);
    expect(result.problems).toEqual([]);
    expect(rowOf(result, "B5-any-result").cells.types.state).toBe("hit");
    expect(result.next).toEqual(["必須の誤った変更はすべて検出しました。画面の表で行の題名の ▶ を押し、少なくとも 1 行に「この仕組みで検出できないこと」を記入します。"]);
    expect(result.durations.total).toBeGreaterThan(0);
    expect(result.testsTimedOut).toBe(false);
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

  it("miss-one: B3 を検出するテストが無ければ B3 だけ検出されない", async () => {
    const result = await scenario("miss-one");

    expect(result.passed).toBe(false);
    expect(result.rows.filter((row) => row.verdict === "slipped").map((row) => row.id)).toEqual([
      "B3-schema-without-uuid",
    ]);
    expect(result.hiddenCount).toBe(1);
  });

  it("false-positive: 正しいコードに当たるルールは誤検知としてルール名を示す", async () => {
    const result = await scenario("false-positive");
    const good = rowOf(result, "G1-solution");

    expect(result.passed).toBe(false);
    expect(result.next).toContain(
      "正しいコード『正しい parse』をLinterが検出しました（ルール no-restricted-syntax、exercises/guard/cases/G1-solution.ts:7）。ルールの対象を狭めるか、テストを見直します。",
    );
    expect(good.verdict).toBe("falsePositive");
    expect(good.detections.lint.map((detection) => detection.label)).toContain("no-restricted-syntax");
    expect(result.next.some((sentence) => sentence.includes("no-restricted-syntax"))).toBe(true);
    expect(rowOf(result, "G2-handler-uses-parse").verdict).toBe("noFalsePositive");
  });

  it("stage: 型のテストが無いと stage 2 の B5 が見えて検出されない", async () => {
    const result = await scenario("no-type-test");

    expect(result.passed).toBe(false);
    expect(result.hiddenCount).toBe(0);
    expect(rowOf(result, "B5-any-result").verdict).toBe("slipped");
    expect(rowOf(result, "B5-any-result").cells.lint.state).toBe("na");
    expect(result.next[0]).toBe("追加の誤った変更が 1 件増えました。");
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
      "まだ誤った変更を 1 件も検出できていません。誤った変更を 1 件選び、eslint.config.mjs の rules に Linter のルールを追加するか、exercises/guard/mine/ にあるテストか型のテストのファイルに書きます。",
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

  it("target-by-name: ファイル名で誤った変更だけを狙うルールは不合格にする", async () => {
    const result = await scenario("target-by-name");

    expect(result.passed).toBe(false);
    expect(result.problems.some((problem) => problem.includes("eslint.config.mjs のルールがケースによって違います（"))).toBe(true);
    expect(result.problems.some((problem) => problem.includes("ルールをファイル名で分けずに"))).toBe(false);
    expect(result.next).toContain("ルールをファイル名で分けずに、コードの形で検出します。");
  });

  it("既存のシナリオの eslint.config.mjs は、全ケースに同じルールを当てる", async () => {
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

  it("rule-throws: ルールの実行中の例外は、ルール名を示す", async () => {
    const result = await scenario("rule-throws");

    expect(result.passed).toBe(false);
    expect(result.problems[0]).toContain("ルール local/explodes の実行中にエラーが出ました");
    expect(result.next).toContain("ルール local/explodes の書き方を見直します。");
    expect(result.problems.join("\n")).not.toContain("読み込めませんでした");
    expect(result.next.some((sentence) => sentence.includes("まだ誤った変更を 1 件も検出できていません"))).toBe(false);
  });

  it("broken-config: ルール名が取れない例外は、設定を読み込めなかった扱いのまま", async () => {
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
    expect(result.testsTimedOut).toBe(true);
    expect(result.next).toContain("実行環境が遅い場合にも発生します。再度「検出を検証する」を押します。繰り返し発生する場合は、テストの中に終わらない繰り返しや、待ち続ける処理がないか見直します。");
    expect(pids).toHaveLength(1);
    expect(await Promise.all(pids.map(groupGone))).toEqual([true]);
  });

  it("test-case-timeout: 1件が testTimeout を超えて失敗したら、testCaseTimedOut を立てる。テスト全体の打ち切りとは分ける", async () => {
    const result = await runScenario("test-case-timeout");

    expect(result.testCaseTimedOut).toBe(true);
    expect(result.testsTimedOut).toBe(false);
  });

  it("miss-one: 通常のテストの失敗では testCaseTimedOut を立てない", async () => {
    const result = await scenario("miss-one");

    expect(result.testCaseTimedOut).toBe(false);
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
    expect(result.next[0]).toContain("まだ誤った変更を 1 件も検出できていません");
  });

  it("配布の mine/ の雛形があり、検出が 0 件なら、まだ誤った変更を 1 件も検出できていませんと伝える", async () => {
    const result = await judge({
      root,
      eslintConfigFile: path.join(scenarios, "empty", "eslint.config.mjs"),
      workDir: "dist/guard-template-only",
    });

    expect(existsSync(path.join(root, "exercises/guard/mine/input.test.ts"))).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.passed).toBe(false);
    expect(result.next[0]).toContain("まだ誤った変更を 1 件も検出できていません");
  });

  it("files-miss: eslint.config.mjs の files がケースに当たらなければ、構文エラーにせず補足に出す", async () => {
    const result = await scenario("files-miss");

    expect(result.problems).toEqual([]);
    expect(result.problems.some((problem) => problem.includes("Parsing error"))).toBe(false);
    expect(result.notes.some((note) => note.includes("対象にしていません"))).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("spec-file: *.spec.ts は実行せず、補足に出す", async () => {
    const result = await scenario("spec-file");

    expect(result.notes.some((note) => note.includes("input.spec.ts は実行しません。テストのファイル名は *.test.ts にします。"))).toBe(true);
  });

  it("verify: 配布時点で検出されず、模範で合格する", async () => {
    const result = await verify({ root });

    expect(result.lines).toHaveLength(2);
    expect(result.ok, result.lines.join("\n")).toBe(true);
    expect(existsSync(path.join(root, "dist/guard-verify/answer/result.json"))).toBe(true);
  });

  it("verify: 配布の mine/ の雛形を使い、誤った変更はすべて検出されず、正しいコードに誤検知が出ない", async () => {
    await verify({ root });
    const initial = JSON.parse(readFileSync(path.join(root, "dist/guard-verify/initial/result.json"), "utf8"));

    expect(existsSync(path.join(root, "exercises/guard/mine/input.test.ts"))).toBe(true);
    expect(initial.rows.filter((/** @type {{ kind: string }} */ row) => row.kind === "bad")).toHaveLength(5);
    expect(
      initial.rows.every((/** @type {{ kind: string, verdict: string }} */ row) =>
        row.kind === "bad" ? row.verdict === "slipped" : row.verdict === "noFalsePositive",
      ),
    ).toBe(true);
    expect(initial.notes).toEqual([]);
  });

  it("verify: 配布の mine/ に誤った変更を検出するテストを入れると失敗する", async () => {
    const copied = copyRoot("verify-detecting-mine");
    placeAnswerTests(copied, ["input.test.ts"]);

    const result = await verify({ root: copied });

    expect(result.ok).toBe(false);
    expect(result.lines[0]).toContain("NG 初期状態: 配布時点で検出される誤った変更があります（B1-any-parser、B2-unknown-cast、B3-schema-without-uuid）");
  });

  it("unchanged: 正しいコードと同じ内容の誤った変更は「未変更」とし、次にすることから外す", async () => {
    const copied = copyRoot("unchanged-root");
    const configFile = path.join(copied, "exercises/guard/guard.config.mjs");
    const caseFile = path.join(copied, "exercises/guard/cases/R1-peer-change.ts");
    const good = readFileSync(path.join(copied, "exercises/guard/cases/G1-solution.ts"), "utf8");
    writeFileSync(
      configFile,
      readFileSync(configFile, "utf8").replace(
        '    {\n      id: "G1-solution",',
        '    {\n      id: "R1-peer-change",\n      kind: "bad",\n      subject: "input",\n      title: "相互レビューで作る誤った変更",\n      stage: 2,\n      required: false,\n      allow: ["types", "lint", "tests"],\n      unchangedFrom: "G1-solution",\n    },\n    {\n      id: "G1-solution",',
      ),
    );
    writeFileSync(caseFile, `// 書き換えます\n${good}`);

    placeAnswerTests(copied, ["input.test.ts", "handler.test.ts", "result.type-test.ts"]);
    const eslintConfigFile = "exercises/guard/answer/eslint.config.mjs";

    const before = await judge({ root: copied, eslintConfigFile, workDir: "dist/guard-unchanged-before" });
    const untouched = rowOf(before, "R1-peer-change");

    expect(untouched.verdict).toBe("unchanged");
    expect(render(before, { color: false })).toContain("未変更");
    expect(before.next.some((sentence) => sentence.includes("相互レビューで作る誤った変更"))).toBe(false);
    expect(before.passed).toBe(true);

    writeFileSync(caseFile, `${good}\nexport const changed = 1;\n`);
    const after = await judge({ root: copied, eslintConfigFile, workDir: "dist/guard-unchanged-after" });

    expect(rowOf(after, "R1-peer-change").verdict).toBe("slipped");
    expect(after.next.some((sentence) => sentence.includes("『相互レビューで作る誤った変更』は検出されていません。"))).toBe(true);
    expect(after.passed).toBe(true);
  });
});

describe("render", () => {
  it("78 桁以内で、止まったという言い方を使わない", async () => {
    const text = render(await scenario("empty"), { color: false });

    expect(text).toContain("未検出");
    expect(text).toContain("結果: まだ合格していません（必須の誤った変更 4 件のうち 0 件を検出）");
    expect(text).not.toMatch(/止ま|止め|実行できない/);
    expect(Math.max(...text.split("\n").map(stringWidth))).toBeLessThanOrEqual(78);
  });

  it("1 件を 2 行で表示し、1 行目に結果の語と題名、2 行目に 3 つの仕組みの結果を置く", async () => {
    const text = render(await scenario("pass"), { color: false });

    expect(text).toMatch(/^\[検出\] .+\n {6}型のテスト .+ \/ Linter .+ \/ テスト .+$/m);
    expect(text).toMatch(/^\[誤検知なし\] .+\n {6}型のテスト .+ \/ Linter .+ \/ テスト .+$/m);
    expect(text).toContain("誤った変更\n");
    expect(text).toContain("正しいコード\n");
    expect(text).not.toContain(" | ");
  });

  it("行頭に句読点や閉じ括弧が来ない", async () => {
    const text = render(await scenario("empty"), { color: false });

    expect(text.split("\n").filter((line) => /^\s*[。、）」』]/.test(line))).toEqual([]);
  });

  it("合格の表示", async () => {
    const text = render(await scenario("pass"), { color: false });

    expect(text.split("\n")[0]).toBe("結果: 合格です");
    expect(text).toContain("次にすること");
    expect(text).toMatch(/所要: 型 [\d.]+s \/ Linter [\d.]+s \/ テスト [\d.]+s \/ 合計 [\d.]+s/);
  });

  it("color のときだけ誤検知の行を赤にする", async () => {
    const result = await scenario("false-positive");

    expect(render(result, { color: true })).toContain("\u001b[31m");
    expect(render(result, { color: false })).not.toContain("\u001b");
  });
});
