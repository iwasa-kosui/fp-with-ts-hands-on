import { describe, expect, it } from "vitest";
import { answerNoteFor } from "./answer-notes";

describe("answerNoteFor", () => {
  it("returns the note for a Session slug and a displayed path", () => {
    expect(
      answerNoteFor(
        "01-state-transitions",
        "exercises/guard/mine/transitions.type-test.ts",
      ),
    ).toBe("「診察開始の引数が Appointment 全体に戻る」を検出します。");
  });

  it("returns nothing for an unknown slug or path", () => {
    expect(answerNoteFor(undefined, "eslint.config.mjs")).toBeUndefined();
    expect(answerNoteFor("missing", "eslint.config.mjs")).toBeUndefined();
    expect(
      answerNoteFor("04-workflow-errors", "exercises/guard/mine/harness.ts"),
    ).toBeUndefined();
  });
});
