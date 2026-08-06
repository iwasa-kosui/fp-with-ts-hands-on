import { describe, expect, it } from "vitest";

import { visitLifecycle } from "../src/visit-lifecycle.js";

describe("Session 01 incident requirements", () => {
  it("固定した5つの来院状態を示す", () => {
    expect(visitLifecycle.states).toEqual([
      "Scheduled",
      "CheckedIn",
      "InExamination",
      "Paid",
      "Canceled",
    ]);
  });

  it("会計済みとキャンセル済みを終端状態として扱う", () => {
    expect(visitLifecycle.terminalStates).toEqual(["Paid", "Canceled"]);
  });

  it("キャンセルには理由とキャンセル時刻を必須とする", () => {
    expect(visitLifecycle.cancellationRequires).toEqual(["reason", "canceledAt"]);
  });
});
