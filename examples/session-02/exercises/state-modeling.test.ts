import { describe, expectTypeOf, it } from "vitest";

import type {
  CheckedIn,
  InExamination,
  Paid,
} from "../src/domain/appointment/appointment.js";
import { toStatusLabel } from "../src/domain/appointment/statusLabel.js";
import {
  cancel,
  checkIn,
  recordPayment,
  startExamination,
} from "../src/domain/appointment/transitions.js";

describe("Step 1", () => {
  it("会計済みの来院から診察を開始できない", () => {
    expectTypeOf<Paid>().not.toMatchTypeOf<Parameters<typeof startExamination>[0]>(); // 要件: 会計済みの来院から診察を開始できない型にしてください。
  });
});

describe("Step 2", () => {
  it("キャンセルには必ず理由を残す", () => {
    expectTypeOf<undefined>().not.toMatchTypeOf<Parameters<typeof cancel>[1]>(); // 要件: キャンセル理由を省略できない型にしてください。
  });
});

describe("Step 3", () => {
  it("来院済みの予約を再度来院済みにできない", () => {
    expectTypeOf<CheckedIn>().not.toMatchTypeOf<Parameters<typeof checkIn>[0]>(); // 要件: 来院済みの予約を再度来院済みにできない型にしてください。
  });

  it("診察結果を記録する前に会計できない", () => {
    expectTypeOf<InExamination>().not.toMatchTypeOf<Parameters<typeof recordPayment>[0]>(); // 要件: 診察結果を記録する前に会計できない型にしてください。
  });
});

describe("Step 4", () => {
  it("未定義の予約状態を表示対象にできない", () => {
    expectTypeOf<Readonly<{ kind: "Deferred" }>>().not.toMatchTypeOf<Parameters<typeof toStatusLabel>[0]>(); // 要件: 未定義の予約状態には表示名を付けられない型にしてください。
  });
});
