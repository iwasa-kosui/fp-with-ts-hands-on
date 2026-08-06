import { describe, expect, it } from "vitest";
import MiniIntegrationPage from "../../../pages/sessions/05-mini-integration.astro";
import { createAstroContainer } from "../../render-astro";

const parseStaticMarkup = (html: string): Document =>
  new DOMParser().parseFromString(
    html.replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
    "text/html",
  );

describe("Session 05", () => {
  it("completes the integration loop and captures the next action", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(MiniIntegrationPage, {
      partial: false,
    });
    const document = parseStaticMarkup(html);

    expect(html).toContain("1関数で要求を受け止めます");
    expect(html).toContain("collectFollowUpTargets");
    expect(html).toContain("petId mismatch");
    expect(html).toContain("exercise:05");

    for (const protectedConcept of [
      "Paid",
      "needsFollowUp",
      "Sensitive",
      "Result",
      "FollowUpRequested",
      "domain event",
    ]) {
      expect(html).toContain(protectedConcept);
    }

    const loop = [...document.querySelectorAll("#integration-loop li")].map(
      ({ textContent }) => textContent?.replaceAll(/\s+/g, " ").trim(),
    );
    expect(loop).toEqual([
      "問題を発見する: テストから、対象判定、petId mismatch、PII、Result、event の不足を特定する。",
      "手段を選ぶ: 既存の状態、入力境界、Sensitive、Result、domain event の役割へ対応付ける。",
      "局所的に変更する: collectFollowUpTargets の1関数だけを編集する。",
      "効果を確認する: exercise:05 を再実行し、守れるようになった制約を確認する。",
    ]);

    expect(
      [...document.querySelectorAll("article h2")].map(({ textContent }) =>
        textContent?.trim(),
      ),
    ).toEqual([
      "追加要求と守る設計をつなぐ",
      "既習技法を選び1関数だけを変える",
      "統合ループで効果を確認する",
      "レビューと完了条件を確認する",
      "次の行動計画",
    ]);

    const tocLinks = [
      ...document.querySelectorAll('nav[aria-label="ページ内目次"] a'),
    ];
    expect(tocLinks).toHaveLength(10);
    expect(tocLinks.every((link) => link.id === "")).toBe(true);
    const tocTargets = [
      ...new Set(tocLinks.map((link) => link.getAttribute("href"))),
    ];
    expect(tocTargets).toHaveLength(5);
    for (const target of tocTargets) {
      expect(target).toMatch(/^#[a-z0-9-]+$/);
      expect(document.querySelectorAll(`article ${target}`)).toHaveLength(1);
    }
    expect(
      document.querySelectorAll(
        ".command-block h1, .command-block h2, .command-block h3",
      ),
    ).toHaveLength(0);

    const actionPlan = document.querySelector(
      "section#action-plan.action-plan",
    );
    expect(actionPlan).not.toBeNull();
    expect(actionPlan?.querySelector("h2")?.textContent?.trim()).toBe(
      "次の行動計画",
    );
    expect(actionPlan?.querySelectorAll("textarea")).toHaveLength(2);
    expect(
      actionPlan
        ?.querySelector('label[for="implementation-location"]')
        ?.textContent?.trim(),
    ).toBe("自分の業務コードで最初に見直す実装箇所を書いてください。");
    expect(
      actionPlan
        ?.querySelector('label[for="first-action"]')
        ?.textContent?.trim(),
    ).toBe("その箇所で最初に試す行動を書いてください。");
    expect(
      actionPlan
        ?.querySelector("textarea#implementation-location")
        ?.getAttribute("name"),
    ).toBe("implementation-location");
    expect(
      actionPlan?.querySelector("textarea#first-action")?.getAttribute("name"),
    ).toBe("first-action");
    expect(actionPlan?.querySelector("button, input[type=submit]")).toBeNull();

    expect(document.querySelector('a[rel="prev"]')?.getAttribute("href")).toBe(
      "/sessions/04-agent-review/",
    );
    expect(document.querySelector('a[rel="next"]')).toBeNull();
  });
});
