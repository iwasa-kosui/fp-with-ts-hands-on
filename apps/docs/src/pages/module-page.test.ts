import { describe, expect, it, vi } from "vitest";
import { startApp } from "../app";
import type { ModuleContent } from "../content/module-content";
import { miniIntegrationModule } from "../content/modules/05-mini-integration";
import { stateModelingModule } from "../content/modules/01-state-modeling";
import { renderModulePage } from "./module-page";
import { renderNotFoundPage } from "./not-found-page";

describe("renderModulePage", () => {
  it("意味のあるランドマークとフォーカス可能な見出し、前後リンクを描画する", () => {
    window.history.replaceState({}, "", "/modules/01-state-modeling/");
    const root = document.createElement("div");
    document.body.append(root);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    const stop = startApp(root, window);

    expect(root.querySelector("header nav")).not.toBeNull();
    expect(root.querySelector("main")).not.toBeNull();
    const heading = root.querySelector<HTMLHeadingElement>("main h1");
    expect(heading?.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(heading);
    expect(root.querySelector('nav a[rel="prev"]')).not.toBeNull();
    expect(root.querySelector('nav a[rel="next"]')).not.toBeNull();

    stop();
    scrollTo.mockRestore();
    root.remove();
  });

  it("モジュールを PRD の学習順序と前後ナビゲーションで描画する", () => {
    const page = renderModulePage(stateModelingModule);

    expect(page.querySelector("h1")?.textContent).toContain("状態遷移を型にする");
    expect(page.textContent).toContain("RABBIT");
    expect(page.textContent).toContain("30分");
    expect(page.textContent).toContain("新しい要求");
    expect(page.textContent).toContain(stateModelingModule.trigger.situation);
    expect(page.textContent).toContain(stateModelingModule.invariant);
    expect(page.textContent).toContain(stateModelingModule.mission);
    expect(page.textContent).toContain(stateModelingModule.red.command);
    expect(page.textContent).toContain(stateModelingModule.green.expected);
    expect(page.textContent).toContain(stateModelingModule.technique.reason);
    expect(page.textContent).toContain("この技法で解決しない範囲");
    expect(page.textContent).toContain(stateModelingModule.technique.limits);
    expect(page.textContent).toContain("要求を状態へ置く");
    expect(page.textContent).toContain(stateModelingModule.reviewPoints[0]);
    expect(page.textContent).toContain(stateModelingModule.doneWhen[0]);
    expect(page.textContent).toContain("業務への転用");
    expect(page.textContent).toContain(stateModelingModule.changeImpact);
    expect(page.textContent).toContain(stateModelingModule.reflectionQuestions[0]);
    expect(page.textContent).toContain(stateModelingModule.fallbackGuidance);
    expect(page.textContent).toContain(stateModelingModule.workedExamples[0]?.file);
    expect(page.querySelectorAll("[data-edit-target]")).toHaveLength(2);

    const previous = page.querySelector<HTMLAnchorElement>('[rel="prev"]');
    const next = page.querySelector<HTMLAnchorElement>('[rel="next"]');
    expect(previous?.href).toContain("/modules/00-read-the-incident/");
    expect(next?.href).toContain("/modules/02-boundary-and-ids/");
  });

  it("サイトヘッダー、ヒーロー、全実習セクションを PRD の順序で描画する", () => {
    const page = renderModulePage(stateModelingModule);
    const siteHeader = page.children[0];
    const main = page.children[1];
    const hero = main?.firstElementChild;

    expect(siteHeader?.matches("header.site-header")).toBe(true);
    expect(main?.matches("main")).toBe(true);
    expect(hero?.matches("section.module-hero")).toBe(true);
    expect(siteHeader?.querySelector('nav a[href="/"]')?.textContent).toContain("トップ");
    expect(hero?.querySelector("h1")?.textContent).toBe("状態遷移を型にする");
    expect(hero?.textContent).toContain("RABBIT");
    expect(hero?.textContent).toContain("30分");

    const structure = [...(main?.children ?? [])].map((element) => {
      if (element.matches("section.module-hero")) return "ヒーロー";
      if (element.matches("section[data-trigger]")) return "起点";
      if (element.matches("figure.code-block")) return "コード本文";
      if (element.matches("nav")) return "前後ナビゲーション";
      return element.firstElementChild?.matches("h2") === true
        ? element.firstElementChild.textContent
        : undefined;
    });

    expect(structure).toEqual([
      "ヒーロー",
      "起点",
      "守る不変条件",
      "ミッション",
      "Red: 失敗を確認する",
      "編集対象",
      "Green: 効果を確認する",
      "使う技法: Discriminated Union",
      "先に読むファイル",
      "要求を状態へ置く",
      "Red",
      "読む場所と編集場所",
      "コード本文",
      "レビューすること",
      "Green",
      "レビュー観点",
      "完了条件",
      "業務への転用",
      "振り返り",
      "代替進行",
      "参考リンク",
      "前後ナビゲーション",
    ]);
  });

  it("起点の kind に対応した見出しを描画する", () => {
    const incidentModule: ModuleContent = {
      ...stateModelingModule,
      trigger: {
        kind: "incident",
        situation: "事故の状況です。",
        incident: "誤った遷移が発生しました。",
      },
    };
    const reviewModule: ModuleContent = {
      ...stateModelingModule,
      trigger: {
        kind: "review",
        situation: "レビューの状況です。",
        reviewProblem: "分岐漏れを指摘されました。",
      },
    };

    expect(renderModulePage(incidentModule).querySelector("[data-trigger] h2")?.textContent).toBe("事故");
    expect(renderModulePage(reviewModule).querySelector("[data-trigger] h2")?.textContent).toBe("レビュー要求");
    expect(renderModulePage(stateModelingModule).querySelector("[data-trigger] h2")?.textContent).toBe(
      "新しい要求",
    );
  });

  it("編集対象を先頭の2つまでに限定する", () => {
    const moduleWithThreeTargets: ModuleContent = {
      ...stateModelingModule,
      editTargets: [
        ...stateModelingModule.editTargets,
        { file: "src/clinic/appointment.ts", symbol: "Appointment.checkIn" },
      ],
    };

    const page = renderModulePage(moduleWithThreeTargets);

    expect(page.querySelectorAll("[data-edit-target]")).toHaveLength(2);
    expect(page.textContent).not.toContain("Appointment.checkIn");
  });

  it("最終演習だけにラベル付きの行動計画入力欄を描画する", () => {
    const finalPage = renderModulePage(miniIntegrationModule);
    const implementation = finalPage.querySelector<HTMLTextAreaElement>(
      'textarea[name="implementation-location"]',
    );
    const firstAction = finalPage.querySelector<HTMLTextAreaElement>('textarea[name="first-action"]');

    expect(implementation).not.toBeNull();
    expect(firstAction).not.toBeNull();
    expect(finalPage.querySelector(`label[for="${implementation?.id}"]`)?.textContent).toBe(
      miniIntegrationModule.finalActionPlan?.implementationPrompt,
    );
    expect(finalPage.querySelector(`label[for="${firstAction?.id}"]`)?.textContent).toBe(
      miniIntegrationModule.finalActionPlan?.firstActionPrompt,
    );
    expect(finalPage.querySelector("form")).toBeNull();
    expect(renderModulePage(stateModelingModule).querySelectorAll("textarea")).toHaveLength(0);
  });

  it("端のモジュールでは存在する方向のナビゲーションだけを描画する", () => {
    const page = renderModulePage(miniIntegrationModule);

    expect(page.querySelector('[rel="prev"]')).not.toBeNull();
    expect(page.querySelector('[rel="next"]')).toBeNull();
  });

  it("参考リンクを外部リソースへのリンクとして描画する", () => {
    const page = renderModulePage(miniIntegrationModule);
    const resource = page.querySelector<HTMLAnchorElement>(
      'a[href="https://kosui.me/posts/2025/05/06/142842"]',
    );

    expect(resource?.textContent).toBe("ドメインイベントを容易に記録する設計");
  });
});

describe("renderNotFoundPage", () => {
  it("見つからない pathname とトップ・モジュール一覧への復帰導線を描画する", () => {
    const page = renderNotFoundPage("/missing/");
    const links = [...page.querySelectorAll<HTMLAnchorElement>("a")];

    expect(page.querySelector("h1")?.textContent).toContain("見つかりません");
    expect(page.textContent).toContain("/missing/");
    expect(links.map(({ pathname }) => pathname)).toContain("/");
    expect(links.map(({ pathname, hash }) => `${pathname}${hash}`)).toContain("/#modules");
    expect(page.textContent).toContain("モジュール一覧");
  });
});
