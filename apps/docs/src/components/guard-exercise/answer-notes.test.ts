import { describe, expect, it } from "vitest";
import { answerNoteFor } from "./answer-notes";

describe("answerNoteFor", () => {
  it("returns the note for a Session slug and a displayed path", () => {
    expect(
      answerNoteFor(
        "01-state-transitions",
        "exercises/guard/mine/transitions.type-test.ts",
      ),
    ).toBe(
      "「診察開始の引数を Appointment 全体に広げる」と「会計の引数を Appointment 全体に広げる」（任意）を検出します。",
    );
  });

  it("puts （任意） after the title of a case whose required is false", () => {
    expect(
      answerNoteFor(
        "01-state-transitions",
        "exercises/guard/mine/transitions.test.ts",
      ),
    ).toBe(
      "「キャンセルの理由ではなく来院の理由を格納する」と「診察開始の時刻に来院の時刻を格納する」（任意）を検出します。",
    );
    expect(
      answerNoteFor("05-business-events-and-workflows", "eslint.config.mjs"),
    ).toBe(
      "「domain の予約が、adaptor/primary/web の変換関数を import する」、「domain の予約が、adaptor/secondary/sqlite の行の型を import する」、「domain の予約が、useCase を import する」（任意）を検出します。",
    );
  });

  it("returns nothing for an unknown slug or path", () => {
    expect(answerNoteFor(undefined, "eslint.config.mjs")).toBeUndefined();
    expect(answerNoteFor("missing", "eslint.config.mjs")).toBeUndefined();
    expect(
      answerNoteFor("04-workflow-errors", "exercises/guard/mine/harness.ts"),
    ).toBeUndefined();
  });
});
