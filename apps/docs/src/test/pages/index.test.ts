import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import HomePage from "../../pages/index.astro";

describe("home page", () => {
  it("preserves the WAN NYAN landing page structure and content", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(HomePage, { partial: false });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector(".home-page.wan-nyan-home")).not.toBeNull();
    expect(document.querySelector(".landing-header")).not.toBeNull();
    expect(document.querySelector(".system-window")).not.toBeNull();
    expect(document.querySelectorAll(".splat-card")).toHaveLength(7);
    expect(document.querySelectorAll(".time-stop")).toHaveLength(7);
    expect(document.querySelector("h1")?.textContent).toContain("WAN NYAN");
    expect(document.querySelector(".copy-panel .landing-eyebrow")).toBeNull();
    expect(document.querySelector(".landing-hero__grid > .landing-eyebrow")).not.toBeNull();
    expect(document.querySelector(".copy-panel .landing-lead")).toBeNull();
    expect(document.querySelector(".landing-hero__grid > .landing-lead")).not.toBeNull();
    expect(document.querySelector(".landing-lead")?.textContent).toContain(
      "1モジュール・最大4ステップ・3つの設計判断・差分予算",
    );
    expect(document.querySelector(".landing-lead")?.textContent).not.toContain("1〜2関数");
    const sessionLink = document.querySelector<HTMLAnchorElement>(
      'a[href="/sessions/00-onboarding/"]',
    );
    expect(sessionLink).not.toBeNull();
    expect(document.body.textContent).toContain(
      "オンボーディング: 退職した先人のコードを引き継ぐ",
    );
    expect(document.querySelector("#sessions")?.textContent).toContain(
      "業務と先人のコードを理解する",
    );
    expect(document.querySelector("#sessions")?.textContent).not.toContain(
      "事故を再現",
    );
  });
});
