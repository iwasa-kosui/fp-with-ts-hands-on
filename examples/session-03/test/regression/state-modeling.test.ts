import { describe, expect, it } from "vitest";

import { compileTypeFixture } from "./compileTypeFixture.js";

describe("Step 1: 会計済みの来院は診察を開始できない", () => {
  it("Paid を渡す呼び出しはコンパイルできない", () => {
    expect(compileTypeFixture("s2-paid-cannot-start.ts")).toEqual([]);
  });
});

describe("Step 2: キャンセルには必ず理由を残す", () => {
  it("reason を省いた呼び出しはコンパイルできない", () => {
    expect(compileTypeFixture("s2-cancel-requires-reason.ts")).toEqual([]);
  });
});

describe("S2 regression: 診察結果を記録していない予約は会計できない", () => {
  it("InExamination を直接渡す呼び出しはコンパイルできない", () => {
    expect(
      compileTypeFixture("s2-payment-requires-completed-examination.ts"),
    ).toEqual([]);
  });
});

describe("Step 3: 全遷移の入口を状態型で絞る", () => {
  it("許可されない遷移元はコンパイルできない", () => {
    expect(compileTypeFixture("s2-transition-sources.ts")).toEqual([]);
  });
});

describe("Step 4: 状態追加時に未対応の分岐をコンパイルエラーにする", () => {
  it("7つ目の状態を足すと status label がコンパイルできない", () => {
    expect(compileTypeFixture("s2-status-exhaustive.ts")).toEqual([]);
  });
});
