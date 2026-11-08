import { describe, expect, it } from "vitest";

import { compileTypeFixture } from "./compileTypeFixture.js";

describe("Step 1: 会計済みの来院は診察を開始できない", () => {
  it("Paid を渡す呼び出しはコンパイルできない", () => {
    expect(compileTypeFixture("paid-cannot-start.ts")).toEqual([]);
  });
});

describe("診察結果を記録していない予約は会計できない", () => {
  it("InExamination を直接渡す呼び出しはコンパイルできない", () => {
    expect(
      compileTypeFixture("payment-requires-completed-examination.ts"),
    ).toEqual([]);
  });
});

describe("Step 2: キャンセルには必ず理由を残す", () => {
  it("reason を省いた呼び出しはコンパイルできない", () => {
    expect(compileTypeFixture("cancel-requires-reason.ts")).toEqual([]);
  });
});

describe("Step 3: 全遷移の入口を状態型で絞る", () => {
  it("許可されない遷移元はコンパイルできない", () => {
    expect(compileTypeFixture("transition-sources.ts")).toEqual([]);
  });
});
