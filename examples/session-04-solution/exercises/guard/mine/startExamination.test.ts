import { describe, expect, it } from "vitest";

import { startExamination } from "../subjects/startExamination.js";
import { call, checkedIn, fakeDependencies, input, scheduled } from "./harness.js";

describe("startExamination", () => {
  it("正しい入力のとき、Ok を返し、予約を保存する", () => {
    const { dependencies, saved } = fakeDependencies({ resolved: checkedIn });
    const outcome = call(() => startExamination(dependencies)(input));
    expect(outcome.kind).toBe("returned");
    if (outcome.kind === "returned") {
      expect(outcome.value.isOk()).toBe(true);
    }
    expect(saved).toHaveLength(1);
  });

  it("予約が見つからないとき", () => {
    const { dependencies, saved } = fakeDependencies({ resolved: undefined });
    const outcome = call(() => startExamination(dependencies)(input));
    // ここに確かめる性質を書きます
  });

  it("状態が来院済みでないとき", () => {
    const { dependencies, saved } = fakeDependencies({ resolved: scheduled });
    const outcome = call(() => startExamination(dependencies)(input));
    // ここに確かめる性質を書きます
  });

  it("保存が例外を投げたとき", () => {
    const saveError = new Error("database unavailable");
    const { dependencies, saved } = fakeDependencies({ resolved: checkedIn, saveError });
    const outcome = call(() => startExamination(dependencies)(input));
    // ここに確かめる性質を書きます
  });
});
