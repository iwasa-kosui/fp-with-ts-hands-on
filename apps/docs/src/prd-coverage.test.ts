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
      expect(renderModulePage(module).textContent).toContain(module.invariant);
    }
  });

  it("PRD-09〜10: 最終演習が一巡と行動計画を含む", () => {
    const finalModule = moduleBySlug("05-mini-integration");
    expect(finalModule).toBeDefined();
    if (finalModule === undefined) throw new Error("05-mini-integration is missing");

    expect(finalModule.editTargets).toHaveLength(1);
    expect(finalModule.finalActionPlan).toBeDefined();

    const page = renderModulePage(finalModule);
    expect(page.textContent).toContain("最初に見直す実装箇所");
    expect(page.textContent).toContain("最初に試す行動");
    expect(page.querySelector('textarea[name="implementation-location"]')).not.toBeNull();
    expect(page.querySelector('textarea[name="first-action"]')).not.toBeNull();
  });
});
