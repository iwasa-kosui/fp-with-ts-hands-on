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
});
