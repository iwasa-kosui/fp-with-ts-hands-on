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

  it("6つ目の状態を足すと status label の分岐を見直せる", () => {
    expect(compileTypeFixture("s2-status-exhaustive.ts")).toEqual([]);
  });
});
