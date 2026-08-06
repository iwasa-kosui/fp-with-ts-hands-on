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
    const requirement = document.querySelector("#requirement");
    const dialogue = requirement?.querySelector(".requirement-dialogue");
    const prompt = requirement?.querySelector(".requirement-prompt");
    const requirementChildren = [...(requirement?.children ?? [])];

    expect(dialogue?.getAttribute("role")).toBe("group");
    expect(dialogue?.getAttribute("aria-label")).toBe("飼い主と受付スタッフの会話");
    const speakers = [...(dialogue?.querySelectorAll(".requirement-dialogue__speaker") ?? [])];
    expect(
      speakers.map(({ textContent }) => textContent),
    ).toEqual(["飼い主", "受付スタッフ"]);
    const ownerLine = dialogue?.querySelector(".requirement-dialogue__line--owner");
    const receptionistLine = dialogue?.querySelector(".requirement-dialogue__line--receptionist");
    expect(ownerLine?.querySelector(".requirement-dialogue__speaker")?.textContent).toBe("飼い主");
    expect(receptionistLine?.querySelector(".requirement-dialogue__speaker")?.textContent).toBe(
      "受付スタッフ",
    );
    const ownerBubble = ownerLine?.querySelector(".requirement-dialogue__bubble");
    const receptionistBubble = receptionistLine?.querySelector(".requirement-dialogue__bubble");
    expect(ownerLine).not.toBe(receptionistLine);
    expect(ownerBubble).not.toBe(receptionistBubble);
    expect(ownerBubble?.parentElement).toBe(ownerLine);
    expect(receptionistBubble?.parentElement).toBe(receptionistLine);
    expect(ownerBubble?.textContent).toContain("キャンセル");
    expect(ownerBubble?.textContent).toContain("再診");
    expect(ownerBubble?.textContent).toContain("希望");
    expect(receptionistBubble?.textContent).toContain("キャンセル理由");
    expect(receptionistBubble?.textContent).toContain("再診希望日");
    expect(prompt?.textContent).toContain("参加者のみなさんへ");
    expect(prompt?.textContent).toContain("要求を整理しよう");
    const mission = requirementChildren.find(({ textContent }) =>
      textContent?.includes("今回のミッションは、この追加要求を状態ごとに必要な情報へ分解することです。"),
    );
    const cancellationExplanation = requirementChildren.find(({ textContent }) =>
      textContent?.replaceAll(/\s+/g, " ").trim().includes("Canceled という状態にだけ必要なデータです。"),
    );
    const invariant = requirementChildren.find(({ textContent }) =>
      textContent?.includes("守る不変条件:"),
    );
    expect(cancellationExplanation?.textContent?.replaceAll(/\s+/g, " ").trim()).toContain(
      "Canceled という状態にだけ必要なデータです。",
    );
    expect(invariant?.textContent).toContain("守る不変条件:");
    expect(mission?.textContent).toContain(
      "今回のミッションは、この追加要求を状態ごとに必要な情報へ分解することです。",
    );
    expect(requirementChildren.indexOf(dialogue as Element)).toBeLessThan(
      requirementChildren.indexOf(prompt as Element),
    );
    expect(requirementChildren.indexOf(prompt as Element)).toBeLessThan(
      requirementChildren.indexOf(cancellationExplanation as Element),
    );
    expect(requirementChildren.indexOf(prompt as Element)).toBeLessThan(
      requirementChildren.indexOf(mission as Element),
    );
    expect(requirementChildren.indexOf(mission as Element)).toBeLessThan(
      requirementChildren.indexOf(cancellationExplanation as Element),
    );
    expect(requirementChildren.indexOf(prompt as Element)).toBeLessThan(
      requirementChildren.indexOf(invariant as Element),
    );
    expect(
      [...document.querySelectorAll("h2")].map(({ textContent }) => textContent),
    ).toEqual(["要求を整理しよう", "要求をテストから読む", "次の編集の準備", "レビューと振り返り"]);
    expect(document.querySelector('a[href="#requirement"]')?.textContent).toBe("要求を整理しよう");
  });
});
