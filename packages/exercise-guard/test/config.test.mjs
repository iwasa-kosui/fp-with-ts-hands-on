import { describe, expect, it } from "vitest";
import { GuardConfigError, validateConfig } from "../src/config.mjs";

const entries = [
  { id: "B1", file: "/cases/B1.ts" },
  { id: "G1", file: "/cases/G1.ts" },
];

const valid = {
  subjects: { input: "subjects/input.ts" },
  cases: [
    { id: "B1", kind: "bad", subject: "input", title: "悪い", allow: ["lint"] },
    { id: "G1", kind: "good", subject: "input", title: "良い" },
  ],
};

/**
 * @param {unknown} raw
 * @param {Partial<{ caseEntries: typeof entries, subjectExists: (path: string) => boolean }>} [overrides]
 * @returns {readonly string[]}
 */
const errorsOf = (raw, overrides = {}) => {
  try {
    validateConfig(raw, {
      caseEntries: entries,
      listErrors: [],
      subjectExists: () => true,
      ...overrides,
    });
    return [];
  } catch (error) {
    if (error instanceof GuardConfigError) {
      return error.messages;
    }
    throw error;
  }
};

describe("validateConfig", () => {
  it("既定値を補う", () => {
    const config = validateConfig(valid, {
      caseEntries: entries,
      listErrors: [],
      subjectExists: () => true,
    });

    expect(config.cases[0]).toEqual({
      id: "B1",
      kind: "bad",
      subject: "input",
      title: "悪い",
      stage: 1,
      required: true,
      allow: ["lint"],
      hint: "",
    });
    expect(config.cases[1]?.allow).toEqual([]);
  });

  it("id の重複を検出する", () => {
    const raw = { ...valid, cases: [...valid.cases, valid.cases[0]] };

    expect(errorsOf(raw).some((message) => message.includes("「B1」が重複"))).toBe(true);
  });

  it("cases/ のファイルと定義の過不足を検出する", () => {
    const raw = { ...valid, cases: [valid.cases[0], { ...valid.cases[1], id: "G9" }] };
    const messages = errorsOf(raw);

    expect(messages.some((message) => message.includes("「G9」は定義にありますが"))).toBe(true);
    expect(messages.some((message) => message.includes("「G1」は"))).toBe(true);
  });

  it("未知の subject と bad の allow 欠落を検出する", () => {
    const raw = {
      ...valid,
      cases: [{ id: "B1", kind: "bad", subject: "nothing", title: "悪い" }, valid.cases[1]],
    };
    const messages = errorsOf(raw);

    expect(messages.some((message) => message.includes("「nothing」は subjects にありません"))).toBe(true);
    expect(messages.some((message) => message.includes("allow が要ります"))).toBe(true);
  });

  it("tests か types で検出する bad がある subject に good が無いと検出する", () => {
    const raw = {
      subjects: { input: "subjects/input.ts", other: "subjects/other.ts" },
      cases: [
        { id: "B1", kind: "bad", subject: "input", title: "悪い", allow: ["tests"] },
        { id: "G1", kind: "good", subject: "other", title: "良い" },
      ],
    };
    const messages = errorsOf(raw);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("subject「input」");
    expect(messages[0]).toContain("good を 1 件以上足します");
  });

  it("lint だけで検出する bad は、good が無くてもよい", () => {
    const raw = {
      subjects: { input: "subjects/input.ts" },
      cases: [{ id: "B1", kind: "bad", subject: "input", title: "悪い", allow: ["lint"] }],
    };

    expect(errorsOf(raw, { caseEntries: [{ id: "B1", file: "/cases/B1.ts" }] })).toEqual([]);
  });

  it("vitestBaseConfig は文字列で、ファイルが要る", () => {
    expect(errorsOf({ ...valid, vitestBaseConfig: 1 })).toEqual(["vitestBaseConfig は root からの相対パスの文字列にします。"]);
    expect(errorsOf({ ...valid, vitestBaseConfig: "vitest.base.config.mjs" }, { subjectExists: (file) => file !== "vitest.base.config.mjs" })).toEqual([
      "vitestBaseConfig のファイル vitest.base.config.mjs がありません。",
    ]);
    expect(
      validateConfig(
        { ...valid, vitestBaseConfig: "vitest.base.config.mjs" },
        { caseEntries: entries, listErrors: [], subjectExists: () => true },
      ).vitestBaseConfig,
    ).toBe("vitest.base.config.mjs");
  });

  it("unchangedFrom は同じ subject の good を指す bad にだけ書ける", () => {
    const withFrom = (/** @type {string} */ from) => ({
      ...valid,
      cases: [{ ...valid.cases[0], unchangedFrom: from }, valid.cases[1]],
    });

    expect(errorsOf(withFrom("G1"))).toEqual([]);
    expect(errorsOf(withFrom("B1"))[0]).toContain("B1 の unchangedFrom「B1」は、同じ subject の正しいコード（good）の id にします。");
    expect(errorsOf(withFrom("G9"))).toHaveLength(1);
    expect(errorsOf({ ...valid, cases: [valid.cases[0], { ...valid.cases[1], unchangedFrom: "B1" }] })[0]).toContain(
      "G1 の unchangedFrom は悪い変更（bad）にだけ指定します。",
    );
    expect(errorsOf(withFrom(/** @type {never} */ (1)))[0]).toContain("unchangedFrom は正しいコード（good）の id の文字列にします。");
    expect(
      validateConfig(withFrom("G1"), { caseEntries: entries, listErrors: [], subjectExists: () => true }).cases[0]?.unchangedFrom,
    ).toBe("G1");
  });

  it("behavior は表示専用で、形が違うと設定エラーにする", () => {
    const behavior = {
      input: { text: "入力", value: "1" },
      expected: { text: "本来" },
      actual: { text: "この変更", value: "2" },
    };
    const withBehavior = (/** @type {unknown} */ value) => ({
      ...valid,
      cases: [{ ...valid.cases[0], behavior: value }, valid.cases[1]],
    });
    const message = "cases[0]（B1） の behavior は { input, expected, actual } にし、それぞれ { text: 空でない文字列, value?: 文字列 } にします。";

    expect(errorsOf(withBehavior(behavior))).toEqual([]);
    expect(errorsOf(withBehavior(undefined))).toEqual([]);
    expect(
      validateConfig(withBehavior(behavior), { caseEntries: entries, listErrors: [], subjectExists: () => true }).cases[0]?.behavior,
    ).toEqual(behavior);
    expect(errorsOf(withBehavior("x"))[0]).toContain(message);
    expect(errorsOf(withBehavior({ ...behavior, actual: undefined }))[0]).toContain(message);
    expect(errorsOf(withBehavior({ ...behavior, input: { text: "" } }))[0]).toContain(message);
    expect(errorsOf(withBehavior({ ...behavior, expected: { text: "本来", value: 1 } }))[0]).toContain(message);
  });

  it("題材のファイルが無いと検出する", () => {
    expect(errorsOf(valid, { subjectExists: () => false })[0]).toContain("subjects/input.ts がありません");
  });
});
