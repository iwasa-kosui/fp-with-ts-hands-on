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

describe("Step 3: 全遷移の入口を状態型で絞る", () => {
  it("許可されない遷移元はコンパイルできない", () => {
    expect(compileTypeFixture("s2-transition-sources.ts")).toEqual([]);
  });
});

describe("Step 4: 状態追加時に表示分岐を見直す", () => {
  it("6つ目の状態を足すと status label がコンパイルできない", () => {
    expect(compileTypeFixture("s2-status-exhaustive.ts")).toEqual([]);
  });
});
