import { describe, expect, it } from "vitest";
import { nextTextForWeb, titleSegments } from "./labels";

describe("nextTextForWeb", () => {
  it("replaces the wording that points at the screen with the wording that points at the table", () => {
    expect(
      nextTextForWeb(
        "必須の誤った変更はすべて検出しました。次へ進む前に、画面の表で行の題名の ▶ を押し、少なくとも 1 つの行に「この仕組みで検出できないこと」を 1 文で記入します。この記入は合格の条件ではありません。",
      ),
    ).toBe(
      "必須の誤った変更はすべて検出しました。次へ進む前に、表の行の題名の ▶ を押し、少なくとも 1 つの行に「この仕組みで検出できないこと」を 1 文で記入します。この記入は合格の条件ではありません。",
    );
  });

  it("keeps a sentence that does not contain the wording", () => {
    expect(nextTextForWeb("まだ仕組みがありません。")).toBe("まだ仕組みがありません。");
  });
});

describe("titleSegments", () => {
  it("splits a title right after a slash or a dot", () => {
    expect(
      titleSegments("domain の予約が、adaptor/primary/web の関数を import する"),
    ).toEqual(["domain の予約が、adaptor/", "primary/", "web の関数を import する"]);
    expect(titleSegments("コード（serverLifecycle.ts）")).toEqual([
      "コード（serverLifecycle.",
      "ts）",
    ]);
    expect(titleSegments("区切りのない題名")).toEqual(["区切りのない題名"]);
  });
});
