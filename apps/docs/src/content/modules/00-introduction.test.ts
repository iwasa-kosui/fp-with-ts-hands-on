import { describe, expect, it } from "vitest";
import { assertModuleMeetsPrd } from "../module-content";
import { breakTheAppModule } from "./00-break-the-app";
import { readTheIncidentModule } from "./00-read-the-incident";

describe("introduction modules", () => {
  it("事故を再現する導入は incident から始まる", () => {
    expect(breakTheAppModule.trigger.kind).toBe("incident");
    expect(breakTheAppModule.editTargets).toHaveLength(0);
    expect(breakTheAppModule.red.command).toContain("exercise:00");
    expect(() => assertModuleMeetsPrd(breakTheAppModule)).not.toThrow();
  });

  it("事故を観察する前に診療シナリオと業務への影響を伝える", () => {
    expect(breakTheAppModule.blocks).toContainEqual({
      kind: "prose",
      heading: "今回の状況",
      paragraphs: [
        "ミケの飼い主から、皮膚の赤みが残っているため再診したいという連絡が入りました。",
        "スタッフは「再診察を開始できるようにしてほしい」と依頼しました。",
        "ところが、会計済みの来院まで診察中へ戻せることが分かりました。",
      ],
    });
    expect(breakTheAppModule.blocks).toContainEqual({
      kind: "prose",
      heading: "事故報告",
      paragraphs: [
        "会計済みの来院が診察中へ戻ると、会計後に確定した診断、処方、請求金額が「まだ診察中の記録」として扱われます。現場では、会計が終わった来院は閉じた記録であり、診察室に戻る操作は業務上存在しません。",
      ],
    });
  });

  it("ワークショップの前提を案内し、共有済みの説明を重複させない", () => {
    const overviewBlocks = breakTheAppModule.introBlocks?.filter(
      (block): block is Extract<(typeof breakTheAppModule.introBlocks)[number], { kind: "overview" }> =>
        block.kind === "overview",
    );

    expect(overviewBlocks?.map(({ heading }) => heading)).toEqual([
      "WAN NYAN OS 開発チームへようこそ",
      "来院のライフサイクル",
      "コードとワークショップの地図",
    ]);
    expect(overviewBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          items: expect.arrayContaining([expect.objectContaining({ title: "プロダクト" })]),
        }),
        expect.objectContaining({
          items: expect.arrayContaining([expect.objectContaining({ title: "状態の流れ" })]),
        }),
        expect.objectContaining({
          items: expect.arrayContaining([expect.objectContaining({ title: "現在の実装" })]),
        }),
      ]),
    );

    for (const block of overviewBlocks ?? []) {
      expect(block.items).not.toHaveLength(0);
      expect(block.items.every(({ title }) => title.length > 0)).toBe(true);
    }

    const onboardingText = JSON.stringify(overviewBlocks);

    for (const expectedText of [
      "予約",
      "受付",
      "診察",
      "会計",
      "カルテ",
      "scheduled",
      "checked-in",
      "in-examination",
      "paid",
      "packages/clinic-example",
      "src/legacy",
      "exercises",
      "src/clinic",
      "事故報告",
      "状態モデリング",
      "境界とID",
      "Result",
      "Agent Review",
    ]) {
      expect(onboardingText).toContain(expectedText);
    }

    for (const duplicateHeading of ["ミッション", "Red", "読むファイル"]) {
      expect(breakTheAppModule.blocks).not.toContainEqual(
        expect.objectContaining({ heading: duplicateHeading }),
      );
    }
  });

  it("要求整理は new-requirement から始まる", () => {
    expect(readTheIncidentModule.trigger.kind).toBe("new-requirement");
    expect(readTheIncidentModule.editTargets).toHaveLength(0);
    expect(readTheIncidentModule.red.command).toContain("exercise:01");
    expect(() => assertModuleMeetsPrd(readTheIncidentModule)).not.toThrow();
  });
});
