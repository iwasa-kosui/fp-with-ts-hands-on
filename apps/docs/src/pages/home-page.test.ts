import { describe, expect, it } from "vitest";
import { renderHomePage } from "./home-page";

describe("renderHomePage", () => {
  it("段階的改善のゴールと参加に必要な案内を意味のあるセクションで描画する", () => {
    const page = renderHomePage();

    expect(page.querySelector("h1")?.textContent).toContain("FP with TypeScript");
    expect(page.textContent).toContain("既存コードを全面刷新せず、1〜2関数の局所変更");
    expect(page.textContent).toContain(
      "要求または事故を読み、不変条件を見つけ、技法を選び、テストまたは型検査で効果を確認します。",
    );

    expect(page.querySelector("main > section.home-hero h1")?.textContent).toContain("FP with TypeScript");
    const sections = Array.from(page.querySelectorAll("main > section:not(.home-hero)")).map(
      (section) => section.querySelector("h2")?.textContent,
    );
    expect(sections).toEqual([
      "対象者",
      "開催情報",
      "学習の流れ",
      "参加前の準備",
      "7つのモジュール",
      "参考情報",
    ]);
    expect(page.textContent).toContain("TypeScript 初級から中級");
    expect(page.textContent).toContain("2026年8月30日 15:00–18:00");
    expect(page.textContent).toContain("Node.js 20 以上");
    expect(page.textContent).toContain("データベース、Docker、外部サービスの API キーは必要ありません。");
    expect(page.querySelector('a[href="https://kosui.me/posts/2026/03/16/typescript-pii-logging-defense"]'))
      .not.toBeNull();
    expect(page.querySelector('a[href="https://kosui.me/posts/2025/05/06/142842"]')).not.toBeNull();
  });

  it("7件のモジュールカードを公開順の正規 URL へリンクする", () => {
    const page = renderHomePage();
    const cards = page.querySelectorAll("[data-module-card]");

    expect(cards).toHaveLength(7);
    expect(
      Array.from(page.querySelectorAll<HTMLAnchorElement>("[data-module-card] a")).map(
        ({ pathname }) => pathname,
      ),
    ).toEqual([
      "/modules/00-break-the-app/",
      "/modules/00-read-the-incident/",
      "/modules/01-state-modeling/",
      "/modules/02-boundary-and-ids/",
      "/modules/03-result-errors/",
      "/modules/04-agent-review/",
      "/modules/05-mini-integration/",
    ]);
    expect(cards[0]?.textContent).toContain("導入事故を起こす");
    expect(cards[6]?.textContent).toContain("ミニ総合演習");
  });
});
