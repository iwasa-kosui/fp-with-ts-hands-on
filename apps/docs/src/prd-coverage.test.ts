import { describe, expect, it } from "vitest";
import { assertModuleMeetsPrd } from "./content/module-content";
import { moduleBySlug, modules } from "./content/modules";
import { renderHomePage } from "./pages/home-page";
import { renderModulePage } from "./pages/module-page";

describe("PRD coverage", () => {
  it("PRD-01: ホームが段階的改善を説明する", () => {
    expect(renderHomePage().textContent).toContain("全面刷新せず");
  });

  it("PRD-02〜08、PRD-12: 全モジュールが共通契約を満たし、不変条件を描画する", () => {
    for (const module of modules) {
      expect(() => assertModuleMeetsPrd(module)).not.toThrow();
      expect(module.technique.name.trim()).not.toBe("");
      expect(module.reflectionQuestions.every((question) => question.trim() !== "")).toBe(true);
      expect(
        module.workedExamples.every(
          (example) =>
            example.file.trim() !== "" &&
            example.symbols.length > 0 &&
            example.symbols.every((symbol) => symbol.trim() !== ""),
        ),
      ).toBe(true);

      const page = renderModulePage(module);
      expect(page.textContent).toContain(module.invariant);
      expect(page.textContent).toContain(module.technique.name);
      for (const question of module.reflectionQuestions) {
        expect(page.textContent).toContain(question);
      }
      for (const example of module.workedExamples) {
        expect(page.textContent).toContain(example.file);
        for (const symbol of example.symbols) {
          expect(page.textContent).toContain(symbol);
        }
      }
    }
  });

  it("PRD-09〜10: 最終演習が一巡と行動計画を含む", () => {
    const finalModule = moduleBySlug("05-mini-integration");
    expect(finalModule).toBeDefined();
    if (finalModule === undefined) throw new Error("05-mini-integration is missing");

    expect(finalModule.editTargets).toHaveLength(1);
    expect(finalModule.finalActionPlan).toBeDefined();
    expect(finalModule.mission).toBe(
      "電話フォロー要求の問題を見つけ、既習技法を選び、1関数だけを変更して、その効果をテストで確認します。",
    );
    expect(finalModule.doneWhen).toEqual([
      "追加要求を既存の設計判断へ対応付けて、collectFollowUpTargets だけを安全に変更できる。",
      "問題の発見、手段の選択、局所的な変更、効果の確認を一巡して説明できる。",
    ]);

    const integrationLoop = finalModule.blocks.find(
      (block) => block.kind === "checklist" && block.heading === "統合ループ",
    );
    if (integrationLoop?.kind !== "checklist") {
      throw new Error("05-mini-integration integration loop is missing");
    }
    expect(integrationLoop).toEqual({
      kind: "checklist",
      heading: "統合ループ",
      items: [
        "問題を発見する: テストから、対象判定、petId mismatch、PII、Result、event の不足を特定する。",
        "手段を選ぶ: 既存の状態、入力境界、Sensitive、Result、domain event の役割へ対応付ける。",
        "局所的に変更する: collectFollowUpTargets の1関数だけを編集する。",
        "効果を確認する: exercise:05 を再実行し、守れるようになった制約を確認する。",
      ],
    });

    const page = renderModulePage(finalModule);
    const mainSections = [...page.querySelectorAll("main > section")];
    const sectionIndex = (heading: string): number =>
      mainSections.findIndex((section) => section.querySelector("h2")?.textContent === heading);
    const missionSection = mainSections[sectionIndex("ミッション")];
    const integrationSection = mainSections[sectionIndex("統合ループ")];
    const doneWhenSection = mainSections[sectionIndex("完了条件")];

    expect(missionSection?.querySelector("p")?.textContent).toBe(finalModule.mission);
    expect(
      [...(integrationSection?.querySelectorAll("li") ?? [])].map(({ textContent }) => textContent),
    ).toEqual(integrationLoop?.items);
    expect(
      [...(doneWhenSection?.querySelectorAll("li") ?? [])].map(({ textContent }) => textContent),
    ).toEqual(finalModule.doneWhen);
    expect(sectionIndex("ミッション")).toBeLessThan(sectionIndex("統合ループ"));
    expect(sectionIndex("統合ループ")).toBeLessThan(sectionIndex("完了条件"));
    expect(page.textContent).toContain("最初に見直す実装箇所");
    expect(page.textContent).toContain("最初に試す行動");
    expect(page.querySelector('textarea[name="implementation-location"]')).not.toBeNull();
    expect(page.querySelector('textarea[name="first-action"]')).not.toBeNull();
  });
});
