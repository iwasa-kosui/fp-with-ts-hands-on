import { describe, expect, it } from "vitest";

import { compileTypeFixture } from "./compileTypeFixture.js";

describe("S2 regression: 予約状態を型で制約する", () => {
  it("Paid を渡す診察開始はコンパイルできない", () => {
    expect(compileTypeFixture("s2-paid-cannot-start.ts")).toEqual([]);
  });

  it("reason を省くキャンセルはコンパイルできない", () => {
    expect(compileTypeFixture("s2-cancel-requires-reason.ts")).toEqual([]);
  });

  it("許可されない遷移元はコンパイルできない", () => {
    expect(compileTypeFixture("s2-transition-sources.ts")).toEqual([]);
  });

  it("7つ目の状態を足すと status label がコンパイルできない", () => {
    expect(compileTypeFixture("s2-status-exhaustive.ts")).toEqual([]);
  });
});

describe("S2 regression: 診察結果を記録していない予約は会計できない", () => {
  it("InExamination を直接渡す呼び出しはコンパイルできない", () => {
    expect(
      compileTypeFixture("s2-payment-requires-completed-examination.ts"),
    ).toEqual([]);
  });
});
