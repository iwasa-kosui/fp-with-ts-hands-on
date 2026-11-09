import { describe, expect, it } from "vitest";

import { toStatusLabel } from "../../subjects/statusLabel.js";

describe("toStatusLabel", () => {
  it.each([
    ["Scheduled", "予約済み"],
    ["CheckedIn", "来院済み"],
    ["InExamination", "診察中"],
    ["AwaitingPayment", "会計待ち"],
    ["Paid", "会計済み"],
    ["Canceled", "キャンセル"],
  ])("%s は「%s」と表示する", (kind, label) => {
    expect(toStatusLabel({ kind } as never)).toBe(label);
  });
});
