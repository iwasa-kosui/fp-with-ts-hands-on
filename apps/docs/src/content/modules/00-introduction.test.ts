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

  it("事故を観察する前に診療シナリオ、影響、ミッション、期待する失敗を伝える", () => {
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
    expect(breakTheAppModule.blocks).toContainEqual({
      kind: "checklist",
      heading: "ミッション",
      items: [
        "通常テストが緑で始まることを確認する。",
        "事故テストを実行し、業務上あり得ない遷移を再現する。",
        "なぜ型が止められないのかを legacy 実装から読む。",
        "次のセッションで守るべきルールを言葉にする。",
      ],
    });
    expect(breakTheAppModule.blocks).toContainEqual({
      kind: "command",
      phase: "red",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:00",
      expected: "exercise:00 は失敗します。失敗していれば正しい状態です。Expected: paid / Received: in-examination",
    });
  });

  it("要求整理は new-requirement から始まる", () => {
    expect(readTheIncidentModule.trigger.kind).toBe("new-requirement");
    expect(readTheIncidentModule.editTargets).toHaveLength(0);
    expect(readTheIncidentModule.red.command).toContain("exercise:01");
    expect(() => assertModuleMeetsPrd(readTheIncidentModule)).not.toThrow();
  });
});
