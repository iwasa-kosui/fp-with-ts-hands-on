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

  it("題材のファイルが無いと検出する", () => {
    expect(errorsOf(valid, { subjectExists: () => false })[0]).toContain("subjects/input.ts がありません");
  });
});
