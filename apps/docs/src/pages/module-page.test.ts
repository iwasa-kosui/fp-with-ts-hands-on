import { describe, expect, it, vi } from "vitest";
import { startApp } from "../app";
import type { ModuleContent } from "../content/module-content";
import { modules } from "../content/modules";
import { breakTheAppModule } from "../content/modules/00-break-the-app";
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
      if (element.matches("nav.module-toc")) return "ページ内目次";
      if (element.matches("section[data-trigger]")) return "起点";
      if (element.matches("figure.code-block")) return "コード本文";
      if (element.matches("nav")) return "前後ナビゲーション";
      return element.firstElementChild?.matches("h2") === true
        ? element.firstElementChild.textContent
        : undefined;
    });

    expect(structure).toEqual([
      "ヒーロー",
      "ページ内目次",
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
      "状態とデータを同時に閉じる",
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

  it("全モジュールで実際のsection順に一意なfragmentを持つページ内目次を描画する", () => {
    for (const module of modules) {
      const page = renderModulePage(module);
      const toc = page.querySelector<HTMLElement>('nav.module-toc[aria-label="ページ内目次"]');
      const links = [...(toc?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]') ?? [])];
      const sections = [
        ...page.querySelectorAll<HTMLElement>("main > section:not(.module-hero)"),
      ];
      const sectionIds = sections.map(({ id }) => id);

      expect(toc).not.toBeNull();
      expect(links).toHaveLength(sections.length);
      expect(sectionIds.every((id) => id !== "")).toBe(true);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
      expect(links.map((link) => link.getAttribute("href"))).toEqual(
        sectionIds.map((id) => `#${id}`),
      );

      for (const link of links) {
        const targetId = link.getAttribute("href")?.slice(1);
        if (targetId === undefined) throw new Error("toc target is missing");
        const targets = [...page.querySelectorAll<HTMLElement>("section[id]")].filter(
          ({ id }) => id === targetId,
        );
        expect(targets).toHaveLength(1);
        expect(link.textContent).toBe(targets[0]?.querySelector("h2")?.textContent);
      }
    }
  });

  it("Module 00の主要項目へページ内目次から移動できる", () => {
    const page = renderModulePage(breakTheAppModule);
    const tocLabels = [
      ...page.querySelectorAll<HTMLAnchorElement>('.module-toc a[href^="#"]'),
    ].map(({ textContent }) => textContent);

    expect(tocLabels).toEqual(
      expect.arrayContaining([
        "事故",
        "守る不変条件",
        "ミッション",
        "Red: 失敗を確認する",
        "Green: 効果を確認する",
        "今回の状況",
        "赤テストを見る",
        "完了条件",
      ]),
    );
  });

  it("Module 00ではオンボーディングを最初の事故タスクより前に目次付きで描画する", () => {
    const page = renderModulePage(breakTheAppModule);
    document.body.append(page);

    try {
      const headings = [...page.querySelectorAll<HTMLElement>("main > section:not(.module-hero) h2")].map(
        ({ textContent }) => textContent,
      );
      const tocLinks = [
        ...page.querySelectorAll<HTMLAnchorElement>('.module-toc a[href^="#"]'),
      ];
      const tocLabels = tocLinks.map(({ textContent }) => textContent);
      const tocHrefs = tocLinks.map((link) => link.getAttribute("href"));
      const countHeadings = (heading: string): number =>
        [...page.querySelectorAll("h2")].filter(({ textContent }) => textContent === heading).length;

      expect(headings.slice(0, 6)).toEqual([
        "この開発に参加するあなたへ",
        "1回の来院で起きること",
        "機能が届ける価値",
        "アプリは業務をどう表すか",
        "開発者として今日行うこと",
        "事故",
      ]);
      expect(tocLabels.slice(0, 5)).toEqual(headings.slice(0, 5));
      expect(tocHrefs.indexOf("#content-value-map-機能が届ける価値")).toBeLessThan(
        tocHrefs.indexOf("#trigger"),
      );
      expect(countHeadings("ミッション")).toBe(1);
      expect(countHeadings("Red: 失敗を確認する")).toBe(1);
      expect(countHeadings("先に読むファイル")).toBe(1);
    } finally {
      page.remove();
    }
  });

  it("code blockも目次から移動できるoptional sectionとして描画する", () => {
    const page = renderModulePage(stateModelingModule);
    const link = [...page.querySelectorAll<HTMLAnchorElement>('.module-toc a[href^="#"]')].find(
      ({ textContent }) => textContent === "状態とデータを同時に閉じる",
    );
    const targetId = link?.getAttribute("href")?.slice(1);
    const target = [...page.querySelectorAll<HTMLElement>("main > section[id]")].find(
      ({ id }) => id === targetId,
    );

    expect(link).toBeDefined();
    expect(link?.getAttribute("href")).toBe("#content-code-状態とデータを同時に閉じる");
    expect(target?.querySelector("h2")?.textContent).toBe("状態とデータを同時に閉じる");
    expect(target?.querySelector("figure.code-block")).not.toBeNull();
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

  it("編集しない導入では空リストの代わりに明示文を描画する", () => {
    const page = renderModulePage(breakTheAppModule);
    const editSection = [...page.querySelectorAll("main > section")].find(
      (section) => section.querySelector("h2")?.textContent === "編集対象",
    );

    expect(editSection?.textContent).toContain("このモジュールではコードを編集しません。");
    expect(editSection?.querySelector("ul")).toBeNull();
    expect(editSection?.querySelectorAll("[data-edit-target]")).toHaveLength(0);
  });

  it("編集するモジュールでは従来どおり編集対象リストを描画する", () => {
    const page = renderModulePage(stateModelingModule);
    const editSection = [...page.querySelectorAll("main > section")].find(
      (section) => section.querySelector("h2")?.textContent === "編集対象",
    );

    expect(editSection?.querySelector("ul")).not.toBeNull();
    expect(editSection?.querySelectorAll("[data-edit-target]")).toHaveLength(2);
    expect(editSection?.textContent).not.toContain("このモジュールではコードを編集しません。");
  });

  it("Module 01で実行時要件とコンパイル時の不正な組み合わせを別のテストから案内する", () => {
    const page = renderModulePage(stateModelingModule);
    const filesSection = [...page.querySelectorAll("main > section")].find(
      (section) => section.querySelector("h2")?.textContent === "先に読むファイル",
    );

    expect(filesSection?.textContent).toContain("exercises/01-state-modeling.test.ts");
    expect(filesSection?.textContent).toContain("実行時要件");
    expect(filesSection?.textContent).toContain("test/01-state-modeling.test.ts");
    expect(filesSection?.textContent).toContain("@ts-expect-error");
    expect(filesSection?.textContent).toContain("コンパイル時");
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
