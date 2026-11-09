import { describe, expect, it } from "vitest";
import { stringWidth, wrapByWidth } from "../src/text.mjs";

describe("wrapByWidth", () => {
  it("行頭に来る句点を避け、1 文字前で折り返す", () => {
    expect(wrapByWidth("あいうえお。かき", 10)).toEqual(["あいうえ", "お。かき"]);
  });

  it("閉じ括弧と読点も行頭に置かず、幅を超えない", () => {
    const lines = wrapByWidth("これは『テスト』です、確認「ずみ」の文章。あいうえおかきくけこ。", 12);

    expect(lines.every((line) => !/^[。、）」』]/.test(line))).toBe(true);
    expect(Math.max(...lines.map(stringWidth))).toBeLessThanOrEqual(12);
    expect(lines.join("")).toBe("これは『テスト』です、確認「ずみ」の文章。あいうえおかきくけこ。");
  });

  it("英数字の語を途中で切らない", () => {
    expect(wrapByWidth("あい no-restricted-syntax う", 20)).toEqual(["あい", "no-restricted-syntax", "う"]);
  });

  it("最後の行が全角 1 文字だけにならないよう、直前の行の末尾の 1 文字を移す", () => {
    expect(wrapByWidth("あいうえおか", 10)).toEqual(["あいうえ", "おか"]);
  });

  it("移す文字が行頭に置けないときは、置ける文字まで移す", () => {
    const lines = wrapByWidth("あいうえ。か", 10);

    expect(lines).toEqual(["あいう", "え。か"]);
    expect(Math.max(...lines.map(stringWidth))).toBeLessThanOrEqual(10);
  });

  it("直前の行の末尾が英数字の語のときは、語を割らずに最後の 1 文字を残す", () => {
    expect(wrapByWidth("あいうえおかabcdefghijkう", 12)).toEqual(["あいうえおか", "abcdefghijk", "う"]);
  });
});
