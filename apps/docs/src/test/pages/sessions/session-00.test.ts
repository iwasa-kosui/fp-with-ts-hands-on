import { describe, expect, it } from "vitest";
import OnboardingPage from "../../../pages/sessions/00-onboarding.astro";
import { createAstroContainer } from "../../render-astro";

const parseStaticMarkup = (html: string): Document =>
  new DOMParser().parseFromString(
    html.replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
    "text/html",
  );

const compact = (text: string | null): string =>
  text?.replaceAll(/\s+/g, " ").trim() ?? "";

describe("Session 00 onboarding page", () => {
  it("onboards the successor without starting an incident exercise", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(OnboardingPage, { partial: false });
    const document = parseStaticMarkup(html);

    expect(document.querySelector("h1")?.textContent).toContain(
      "オンボーディング: 退職した先人のコードを引き継ぐ",
    );
    expect(document.querySelector(".case-file__eyebrow")?.textContent).toContain(
      "SESSION 00 · 30分",
    );
    expect(html).toContain("すべてバイブコーディングで作りました");
    expect(html).toContain("そこで採用されたエンジニアが、あなたです");
    expect(html).not.toContain("事故報告");
    expect(html).not.toContain("事故を再現");
    expect(html).not.toContain("pnpm exercise:00");
    expect(html).not.toContain('data-action="run"');
    expect(html).not.toContain('data-action="reset"');

    const story = document.querySelector(".onboarding-story");
    expect(story?.getAttribute("role")).toBe("group");
    expect(story?.getAttribute("aria-label")).toBe(
      "先人の獣医から新任エンジニアへの引き継ぎ",
    );
    expect(
      [...(story?.querySelectorAll(".onboarding-story__speaker") ?? [])].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["先人の獣医", "院長", "院長"]);
    expect(
      [...(story?.querySelectorAll(".onboarding-story__bubble") ?? [])].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual([
      "この動物病院のシステムは、診療の合間にすべてバイブコーディングで作りました！",
      "その偉大な獣医さんが退職してしまいました。システムのことを詳しく知る人がいません……",
      "そこで採用されたエンジニアが、あなたです。まずは病院の仕事と先人のコードを知るところから始めてください",
    ]);

    const headings = [
      "着任初日のオンボーディング",
      "この病院とアプリケーションを知る",
      "来院とコードの対応を知る",
      "先人のコードを眺める",
      "明日の開発に備える",
    ];
    expect([...document.querySelectorAll("article h2")].map(({ textContent }) => textContent)).toEqual(
      headings,
    );
    expect(
      [...document.querySelectorAll('nav[aria-label="ページ内目次"] a')]
        .slice(0, 5)
        .map(({ textContent }) => textContent),
    ).toEqual(headings);
    expect(document.querySelectorAll("[data-code-guide]")).toHaveLength(5);

    expect(compact(document.querySelector(".onboarding-decision")?.textContent ?? null)).toBe(
      "しかし、まだ問題は顕在化していません。迂闊にリファクタリングすれば、既存仕様を壊してしまうかもしれません。今日は業務、仕様、設計の理解に留め、明日から実際の開発に着手しましょう。",
    );
  });

  it("preserves the visit flow and maps its business concepts to code", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(OnboardingPage, { partial: false });
    const document = parseStaticMarkup(html);
    const transitionTimeline = document.querySelector(
      "ol#visit-state-transitions.visit-timeline",
    );

    expect(transitionTimeline?.getAttribute("aria-label")).toBe("来院の状態遷移");

    const steps = [...(transitionTimeline?.children ?? [])].filter((child) =>
      child.classList.contains("visit-timeline__step"),
    );
    expect(steps).toHaveLength(4);
    expect(
      steps.map((step) => ({
        event: compact(step.querySelector("h4")?.textContent ?? null),
        actor: compact(step.querySelector(".visit-timeline__actor")?.textContent ?? null),
        states: [...step.querySelectorAll(".visit-timeline__state")].map((state) => ({
          name: compact(state.querySelector(".visit-timeline__state-name")?.textContent ?? null),
          code: state.querySelector("code")?.textContent ?? null,
        })),
        record: compact(step.querySelector(".visit-timeline__record")?.textContent ?? null),
      })),
    ).toEqual([
      {
        event: "予約を受け付ける",
        actor: "飼い主",
        states: [
          { name: "来院記録なし", code: null },
          { name: "予約済み", code: "scheduled" },
        ],
        record: "予約日時を残す",
      },
      {
        event: "来院を確認する",
        actor: "受付スタッフ",
        states: [
          { name: "予約済み", code: "scheduled" },
          { name: "受付済み", code: "checked-in" },
        ],
        record: "受付時刻を残す",
      },
      {
        event: "診察を開始する",
        actor: "獣医師",
        states: [
          { name: "受付済み", code: "checked-in" },
          { name: "診察中", code: "in-examination" },
        ],
        record: "担当獣医師と診察開始時刻を残す",
      },
      {
        event: "会計を確定する",
        actor: "会計担当",
        states: [
          { name: "診察中", code: "in-examination" },
          { name: "会計済み・来院完了", code: "paid" },
        ],
        record: "診断、処置、請求金額、会計時刻を残す",
      },
    ]);

    const cancellationBranch = document.querySelector(".visit-timeline__branch");
    expect(compact(cancellationBranch?.querySelector(".visit-timeline__actor")?.textContent ?? null)).toBe(
      "飼い主または病院",
    );
    expect(compact(cancellationBranch?.textContent ?? null)).toContain(
      "予約済みまたは受付済みからだけキャンセルでき、キャンセル",
    );
    expect(compact(document.querySelector(".visit-timeline__terminal")?.textContent ?? null)).toContain(
      "Paid と Canceled は終端状態",
    );

    const correspondence = [...document.querySelectorAll("#visit-and-code tbody tr")].map(
      (row) => [
        compact(row.querySelector('th[scope="row"]')?.textContent ?? null),
        compact(row.querySelector("td code")?.textContent ?? null),
      ],
    );
    expect(correspondence).toEqual([
      ["来院記録", "LegacyAppointment"],
      ["予約を受け付ける", "bookAppointment"],
      ["状態を更新する", "updateStatus"],
      ["運用ログ", "logger.info"],
    ]);
  });
});
