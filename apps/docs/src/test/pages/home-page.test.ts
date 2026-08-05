import { describe, expect, it } from "vitest";
import { renderHomePage } from "../../pages/home-page";
import { renderNotFoundPage } from "../../pages/not-found-page";

describe("renderHomePage", () => {
  it("元の WAN NYAN CLINIC のヒーローと問題導線を復元する", () => {
    const page = renderHomePage();

    expect(page.querySelector("h1")?.textContent).toContain("WAN NYAN");
    expect(page.querySelector("#system [aria-label=\"動物病院の予約・カルテシステム画面\"]")).not.toBeNull();
    expect(page.querySelectorAll("#features .splat-card")).toHaveLength(7);
    expect(page.querySelectorAll("#problems .time-stop")).toHaveLength(7);
    expect(page.querySelector<HTMLAnchorElement>('a[href="#features"]')?.textContent).toBe("FEATURES");
    expect(page.querySelector<HTMLAnchorElement>('a[href="#problems"]')?.textContent).toBe("PROBLEMS");
    expect(page.querySelector<HTMLAnchorElement>('.landing-nav a[href="/modules/00-break-the-app/"]')?.textContent).toBe(
      "MODULE 00",
    );
  });

  it("WAN NYAN OS の機能、現場の問題、導入事故への案内を描画する", () => {
    const page = renderHomePage();

    expect(page.textContent).toContain("今日の診察");
    expect(page.textContent).toContain("WAN NYAN OSでできること");
    expect(page.textContent).toContain("ところが、問題が増えてきた");
    expect(page.textContent).toContain("会計済みが診察中へ戻る");
    expect(page.textContent).toContain("急募！どうにかしてくれるエンジニア！");
  });

  it("ページ内ナビゲーションと Module 00 の正規 URL を提供する", () => {
    const page = renderHomePage();

    expect(page.querySelector<HTMLAnchorElement>('.landing-nav a[href="#system"]')?.textContent).toBe("TOP");
    expect(page.querySelector<HTMLAnchorElement>('.landing-nav a[href="#features"]')?.textContent).toBe("FEATURES");
    expect(page.querySelector<HTMLAnchorElement>('.landing-nav a[href="#problems"]')?.textContent).toBe("PROBLEMS");
    expect(page.querySelectorAll<HTMLAnchorElement>('a[href="/modules/00-break-the-app/"]')).toHaveLength(2);
  });

  it("404のモジュール一覧リンクがホームに実在するfragmentを指す", () => {
    const home = renderHomePage();
    const notFound = renderNotFoundPage("/missing/");
    document.body.append(home, notFound);

    const link = notFound.querySelector<HTMLAnchorElement>('a[href="/#modules"]');
    if (link === null) throw new Error("modules fragment link is missing");
    const targetId = new URL(link.href).hash.slice(1);

    expect(targetId).toBe("modules");
    expect(document.querySelectorAll(`[id="${targetId}"]`)).toHaveLength(1);
    expect(document.getElementById(targetId)?.querySelector("h2")?.textContent).toBe(
      "急募！どうにかしてくれるエンジニア！",
    );

    home.remove();
    notFound.remove();
  });
});
