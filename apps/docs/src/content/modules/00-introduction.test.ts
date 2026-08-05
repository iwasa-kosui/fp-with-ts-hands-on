import { describe, expect, it } from "vitest";
import { assertModuleMeetsPrd } from "../module-content";
import type { ContentBlock } from "../module-content";
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

  it("顧客体験から守る価値と実装へ進む順にオンボーディングする", () => {
    const blocksWithHeading = (breakTheAppModule.introBlocks ?? []).filter(
      (block): block is Exclude<ContentBlock, { kind: "command" }> => block.kind !== "command",
    );

    expect(blocksWithHeading.map(({ heading }) => heading)).toEqual([
      "この開発に参加するあなたへ",
      "1回の来院で起きること",
      "機能が届ける価値",
      "アプリは業務をどう表すか",
      "開発者として今日行うこと",
    ]);

    const valueMap = breakTheAppModule.introBlocks?.find((block) => block.kind === "value-map");
    expect(valueMap).toMatchObject({
      rows: [
        { function: "予約・受付", audiences: "受付スタッフ、飼い主", value: "来院を迷わず正しく受け入れられる。" },
        { function: "診察・カルテ", audiences: "獣医師、病院スタッフ", value: "診療の記録を一貫して扱える。" },
        { function: "会計", audiences: "会計担当、飼い主", value: "確定した来院記録と会計を誤って壊さない。" },
        { function: "フォロー・連絡先・申し送り", audiences: "病院スタッフ、飼い主", value: "必要な連絡を安全に引き継げる。" },
      ],
    });

    const visitBlock = breakTheAppModule.introBlocks?.find(
      (block) => block.kind !== "command" && block.heading === "1回の来院で起きること",
    );
    const visitText = JSON.stringify(visitBlock);
    for (const expectedText of ["予約", "受付", "診察と記録", "会計と完了", "再診"]) {
      expect(visitText).toContain(expectedText);
    }
    const reExaminationItem = visitBlock?.kind === "overview"
      ? visitBlock.items.find(({ title }) => title === "再診")
      : undefined;
    expect(reExaminationItem?.description).toBe("再診の正規操作は今回の演習では扱いません。");
    for (const state of ["scheduled", "checked-in", "in-examination", "paid"]) {
      expect(visitText).not.toContain(state);
    }

    const stateBlock = breakTheAppModule.introBlocks?.find(
      (block) => block.kind !== "command" && block.heading === "アプリは業務をどう表すか",
    );
    const stateText = JSON.stringify(stateBlock);
    for (const expectedText of ["scheduled", "checked-in", "in-examination", "paid"]) {
      expect(stateText).toContain(expectedText);
    }
    expect(stateText).toContain("paid の来院を診察中へ戻さない");
    expect(stateText).toContain("再診の正規操作は今回の演習では扱いません。");

    const developerBlock = breakTheAppModule.introBlocks?.find(
      (block) => block.kind !== "command" && block.heading === "開発者として今日行うこと",
    );
    const developerText = JSON.stringify(developerBlock);
    for (const expectedText of [
      "packages/clinic-example",
      "src/legacy",
      "exercises",
      "test",
      "src/clinic",
      "事故報告",
      "状態モデリング",
      "境界とID",
      "Result",
      "Agent Review",
    ]) {
      expect(developerText).toContain(expectedText);
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
