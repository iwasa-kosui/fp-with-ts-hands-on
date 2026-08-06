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
    const transitionTable = document.querySelector("#visit-state-transitions");

    expect(transitionTable?.getAttribute("aria-label")).toBe("来院の状態遷移");
    expect(
      [...(transitionTable?.querySelectorAll("thead th") ?? [])].map((cell) =>
        compact(cell.textContent),
      ),
    ).toEqual(["業務で起きること", "遷移前の状態", "遷移後の状態", "その状態に残る情報"]);
    expect(
      [...(transitionTable?.querySelectorAll("tbody tr") ?? [])].map((row) =>
        [...row.querySelectorAll("th, td")].map((cell) => compact(cell.textContent)),
      ),
    ).toEqual([
      ["飼い主の予約を受け付ける", "来院記録なし", "予約済み（scheduled）", "予約日時"],
      ["受付スタッフが来院を確認する", "予約済み（scheduled）", "受付済み（checked-in）", "受付時刻"],
      ["獣医師が診察を開始する", "受付済み（checked-in）", "診察中（in-examination）", "担当獣医師、診察開始時刻"],
      ["会計担当が診療内容と請求を確定する", "診察中（in-examination）", "会計済み・来院完了（paid）", "診断、処置、請求金額、会計時刻"],
      ["飼い主または病院が予約を取り消す", "予約済み（scheduled）または受付済み（checked-in）", "キャンセル（canceled）", "キャンセル理由、キャンセル時刻、任意の再診希望日"],
    ]);
    expect(html).toContain("Paid と Canceled は終端状態");
    expect(html).toContain("再診は新しい予約として扱い、今回の演習では扱いません");

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
