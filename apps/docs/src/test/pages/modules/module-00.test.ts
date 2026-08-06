import { describe, expect, it } from "vitest";
import BreakTheAppPage from "../../../pages/modules/00-break-the-app.astro";
import ReadTheIncidentPage from "../../../pages/modules/00-read-the-incident.astro";
import { createAstroContainer } from "../../render-astro";

const parseStaticMarkup = (html: string): Document =>
  new DOMParser().parseFromString(
    html.replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
    "text/html",
  );

describe("Module 00 pages", () => {
  it("onboards participants before reproducing the incident", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(BreakTheAppPage, { partial: false });

    expect(html).toContain("開発に参加する前に");
    expect(html).toContain("動物病院の役割");
    expect(html).toContain("1回の来院の流れ");
    expect(html).toContain("登場人物");
    expect(html).toContain("提供する機能と価値");
    expect(html).toContain("来院をモデリングしよう");
    expect(html).toContain("Paid は終端状態");
    expect(html).toContain("exercise:00");
    expect(html).toContain("src/legacy/appointment.ts");

    const document = parseStaticMarkup(html);
    const compact = (text: string | null): string =>
      text?.replaceAll(/\s+/g, " ").trim() ?? "";
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
    expect(
      compact(document.querySelector(".visit-timeline__terminal")?.textContent ?? null),
    ).toContain("Paid と Canceled は終端状態");

    expect([...document.querySelectorAll("h2")].map(({ textContent }) => textContent)).toEqual([
      "開発に参加する前に",
      "事故を観察する",
      "失敗を再現する",
      "レビューと次のセッション",
    ]);
  });

  it("turns the cancellation incident into the next modeling requirement", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(ReadTheIncidentPage, { partial: false });

    expect(html).toContain("事故報告を読む");
    expect(html).toContain("Canceled は reason を持ち");
    expect(html).toContain("キャンセル理由");
    expect(html).toContain("exercise:01");

    const document = parseStaticMarkup(html);
    expect(
      [...document.querySelectorAll("h2")].map(({ textContent }) => textContent),
    ).toEqual(["要求を分解する", "要求をテストから読む", "次の編集の準備", "レビューと振り返り"]);
  });
});
