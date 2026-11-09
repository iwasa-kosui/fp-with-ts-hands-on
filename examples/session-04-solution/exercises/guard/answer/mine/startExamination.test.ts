import { describe, expect, it } from "vitest";

import { startExamination } from "../../subjects/startExamination.js";
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

  it("予約が見つからないとき、例外を投げずに Err を返し、保存しない", () => {
    const { dependencies, saved } = fakeDependencies({ resolved: undefined });
    const outcome = call(() => startExamination(dependencies)(input));
    expect(outcome.kind).toBe("returned");
    expect(outcome.kind === "returned" && outcome.value.isErr()).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it("状態が来院済みでないとき、例外を投げずに Err を返し、保存しない", () => {
    const { dependencies, saved } = fakeDependencies({ resolved: scheduled });
    const outcome = call(() => startExamination(dependencies)(input));
    expect(outcome.kind).toBe("returned");
    expect(outcome.kind === "returned" && outcome.value.isErr()).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it("保存が例外を投げたとき、同じ例外がそのまま外へ出る", () => {
    const saveError = new Error("database unavailable");
    const { dependencies } = fakeDependencies({ resolved: checkedIn, saveError });
    const outcome = call(() => startExamination(dependencies)(input));
    expect(outcome.kind).toBe("threw");
    expect(outcome.kind === "threw" && outcome.error).toBe(saveError);
  });
});
