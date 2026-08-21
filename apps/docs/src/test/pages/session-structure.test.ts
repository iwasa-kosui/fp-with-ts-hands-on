import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";
import { renderSessionPage, sessionCases } from "./session-test-helpers";

const chapterIds = {
  orientation: ["incident", "legacy", "review"],
  workshop: ["incident", "workflow", "review"],
  exercise: ["incident", "legacy", "red", "refactor", "review"],
  reference: ["incident", "legacy", "review"],
} as const;

describe("session page structure", () => {
  it.each(sessionCases)("renders catalog chapters and both TOCs for $name", async ({ session }) => {
    const document = await renderSessionPage(session);
    const expectedIds = chapterIds[session.kind];
    const directSections = [
      ...document.querySelectorAll<HTMLElement>("article.case-file__content > section"),
    ];

    expect(document.querySelector("h1")?.textContent).toBe(session.title);
    expect(directSections.map(({ id }) => id)).toEqual(expectedIds);
    expect(document.querySelectorAll('nav[aria-label="ページ内目次"]')).toHaveLength(2);

    const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of expectedIds) {
      expect(
        document.querySelectorAll(`nav[aria-label="ページ内目次"] a[href="#${id}"]`),
      ).toHaveLength(2);
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1);
      expect(document.querySelector(`#${id}`)?.firstElementChild?.tagName).toBe("H2");
    }
  });

  it("runs S1 as an event-storming workshop without workflow cards or code exercise traces", async () => {
    const session = sessions.find(({ kind }) => kind === "workshop")!;
    const document = await renderSessionPage(session);
    const text = document.body.textContent ?? "";

    expect(text).toContain("15分");
    expect(document.querySelector(".workflow-card")).toBeNull();
    expect(document.querySelector(".workflow-risk-map")).toBeNull();
    expect(document.querySelector("[data-code-explorer]")).toBeNull();
    expect(document.querySelector(".command-block")).toBeNull();
    expect(document.querySelector("details.step-solution")).toBeNull();
    expect(text).not.toContain("pnpm exercise:");
    expect(text).toContain("講師回答例");

    const events = [
      ...document.querySelectorAll<HTMLElement>("[data-domain-event-id]"),
    ];
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events.every((event) => event.dataset.aggregate !== undefined)).toBe(true);

    const teacherDemoCard = document.querySelector<HTMLElement>(
      "#workflow [data-domain-event-id]",
    );
    expect(teacherDemoCard?.dataset.aggregate).toBe("予約");

    const reviewEvents = [
      ...document.querySelectorAll<HTMLElement>(
        "#review [data-domain-event-id]",
      ),
    ];
    expect(reviewEvents).toHaveLength(5);
    expect(new Set(reviewEvents.map((event) => event.dataset.domainEventId)).size).toBe(5);
  });

  it("shows the exact 3+4+6+2 S1 timing", async () => {
    const session = sessions.find(({ kind }) => kind === "workshop")!;
    const document = await renderSessionPage(session);

    expect(document.querySelector("#incident h2")?.textContent).toContain(
      "ブリーフィング3分",
    );
    expect(
      [...document.querySelectorAll("#workflow > h3")].map(({ textContent }) =>
        textContent?.trim(),
      ),
    ).toEqual([
      "説明4分: 語彙とドメインイベントの拾い方を確認する",
      "班ワーク6分: 残りのドメインイベントを拾い、境界を引く",
    ]);
    expect(document.querySelector("#review h2")?.textContent).toContain(
      "レビュー2分",
    );
  });

  it("presents the event-storming vocabulary, the four-step procedure, and the Excalidraw template link on S1", async () => {
    const session = sessions.find(({ kind }) => kind === "workshop")!;
    const document = await renderSessionPage(session);
    const workflowSection = document.querySelector("#workflow")!;
    const text = workflowSection.textContent ?? "";

    for (const term of ["ドメインイベント", "コマンド", "ワークフロー", "集約"]) {
      expect(text).toContain(term);
    }
    for (const step of [
      "起きた出来事を過去形で書き出す",
      "時間の順に並べる",
      "それぞれの出来事が、誰の何の依頼で起きたかを添える",
      "同じ集約を変えるドメインイベントをまとめ、集約に名前を付ける",
    ]) {
      expect(text).toContain(step);
    }
    const templateLink = workflowSection.querySelector<HTMLAnchorElement>(
      'a[href*="docs/event/session-01-event-storming.excalidraw"]',
    );
    expect(templateLink).not.toBeNull();
  });

  it("groups the S1 review examples by aggregate and connects the reservation aggregate to S2", async () => {
    const session = sessions.find(({ kind }) => kind === "workshop")!;
    const document = await renderSessionPage(session);
    const reviewSection = document.querySelector("#review")!;

    const groups = [
      ...reviewSection.querySelectorAll<HTMLElement>(".aggregate-group"),
    ];
    expect(groups.map((group) => group.dataset.aggregate)).toEqual([
      "予約",
      "カルテ",
      "会計",
    ]);

    for (const group of groups) {
      const cards = [
        ...group.querySelectorAll<HTMLElement>("[data-domain-event-id]"),
      ];
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.dataset.aggregate).toBe(group.dataset.aggregate);
      }
    }

    const reviewText = reviewSection.textContent ?? "";
    expect(reviewText).toContain("予約");
    expect(reviewText).toContain("診察を始める");
  });
});
