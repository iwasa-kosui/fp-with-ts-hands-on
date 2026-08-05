import { describe, expect, it } from "vitest";
import BreakTheAppPage from "../../../pages/modules/00-break-the-app.astro";
import ReadTheIncidentPage from "../../../pages/modules/00-read-the-incident.astro";
import { createAstroContainer } from "../../render-astro";

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
  });

  it("turns the cancellation incident into the next modeling requirement", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(ReadTheIncidentPage, { partial: false });

    expect(html).toContain("事故報告を読む");
    expect(html).toContain("Canceled は reason を持ち");
    expect(html).toContain("キャンセル理由");
    expect(html).toContain("exercise:01");
  });
});
