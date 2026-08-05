import { describe, expect, it } from "vitest";
import type { ContentBlock, OnboardingChapter } from "../content/module-content";
import { renderContentBlock, renderOnboardingChapter } from "./content-block";

describe("renderContentBlock", () => {
  it("すべてのブロック種別を内容のある要素として描画する", () => {
    const blocks: readonly ContentBlock[] = [
      { kind: "prose", heading: "要求", paragraphs: ["変更内容を確認します。"] },
      { kind: "code", heading: "型", language: "ts", code: "type Status = 'paid';" },
      { kind: "command", phase: "red", command: "pnpm exercise:01", expected: "FAIL" },
      {
        kind: "file-table",
        heading: "読むファイル",
        rows: [{ file: "src/a.ts", focus: "状態", mode: "read" }],
      },
      { kind: "checklist", heading: "完了条件", items: ["型検査が通ります。"] },
      {
        kind: "overview",
        heading: "このアプリで扱うこと",
        introduction: "業務の全体像を確認してから、最初の依頼に取り組みます。",
        items: [{ title: "予約", description: "来院の予定を登録する起点です。" }],
      },
      {
        kind: "value-map",
        heading: "機能が届ける価値",
        introduction: "各機能が、誰にどんな価値を届けるかを確認します。",
        rows: [
          {
            function: "予約・受付",
            audiences: "受付スタッフ、飼い主",
            value: "来院を迷わず正しく受け入れられる。",
          },
        ],
      },
    ];

    for (const block of blocks) {
      const element = renderContentBlock(block);
      expect(element.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("prose を見出しと段落で描画する", () => {
    const element = renderContentBlock({
      kind: "prose",
      heading: "要求を読む",
      paragraphs: ["1つ目の説明です。", "2つ目の説明です。"],
    });

    expect(element.querySelector("h2")?.textContent).toBe("要求を読む");
    expect([...element.querySelectorAll("p")].map(({ textContent }) => textContent)).toEqual([
      "1つ目の説明です。",
      "2つ目の説明です。",
    ]);
  });

  it("code を題名、言語、コード本文が区別できる figure で描画する", () => {
    const element = renderContentBlock({
      kind: "code",
      heading: "状態の型",
      language: "typescript",
      code: "type Status = 'Paid';",
    });

    expect(element.tagName).toBe("FIGURE");
    expect(element.querySelector("figcaption")?.textContent).toContain("状態の型");
    expect(element.querySelector("figcaption")?.textContent).toContain("typescript");
    expect(element.querySelector("code")?.textContent).toBe("type Status = 'Paid';");
  });

  it("command をフェーズ、実行コマンド、期待結果とともに描画する", () => {
    const element = renderContentBlock({
      kind: "command",
      phase: "green",
      command: "pnpm exercise:01",
      expected: "PASS",
    });

    expect(element.dataset.phase).toBe("green");
    expect(element.querySelector("h2")?.textContent).toBe("Green");
    expect(element.querySelector("code")?.textContent).toBe("pnpm exercise:01");
    expect(element.textContent).toContain("期待結果");
    expect(element.textContent).toContain("PASS");
  });

  it("file-table を列見出しと操作種別のある table で描画する", () => {
    const element = renderContentBlock({
      kind: "file-table",
      heading: "読む場所",
      rows: [
        { file: "src/read.ts", focus: "状態", mode: "read" },
        { file: "src/edit.ts", focus: "遷移", mode: "edit" },
      ],
    });

    expect(element.querySelector("h2")?.textContent).toBe("読む場所");
    expect([...element.querySelectorAll("th")].map(({ textContent }) => textContent)).toEqual([
      "ファイル",
      "確認すること",
      "操作",
    ]);
    expect([...element.querySelectorAll("tbody tr")].map((row) => row.textContent)).toEqual([
      "src/read.ts状態読む",
      "src/edit.ts遷移編集",
    ]);
  });

  it("checklist を見出し付きリストで描画する", () => {
    const element = renderContentBlock({
      kind: "checklist",
      heading: "完了条件",
      items: ["型検査が通る", "テストが通る"],
    });

    expect(element.querySelector("h2")?.textContent).toBe("完了条件");
    expect([...element.querySelectorAll("li")].map(({ textContent }) => textContent)).toEqual([
      "型検査が通る",
      "テストが通る",
    ]);
  });

  it("overview を見出し、導入、項目一覧の section で描画する", () => {
    const element = renderContentBlock({
      kind: "overview",
      heading: "このアプリで扱うこと",
      introduction: "業務の全体像を確認してから、最初の依頼に取り組みます。",
      items: [{ title: "予約", description: "来院の予定を登録する起点です。" }],
    });

    expect(element.tagName).toBe("SECTION");
    expect(element.querySelector("h2")?.textContent).toBe("このアプリで扱うこと");
    expect(element.querySelector("p")?.textContent).toBe(
      "業務の全体像を確認してから、最初の依頼に取り組みます。",
    );
    expect(element.querySelector("ul")).not.toBeNull();
    expect([...element.querySelectorAll("li")].map(({ textContent }) => textContent)).toEqual([
      "予約: 来院の予定を登録する起点です。",
    ]);
    expect(element.querySelector("li strong")?.nextSibling?.textContent).toBe(
      ": 来院の予定を登録する起点です。",
    );
  });

  it("value-map を見出し、説明、列見出し、全行を持つ意味論的な table で描画する", () => {
    const element = renderContentBlock({
      kind: "value-map",
      heading: "機能が届ける価値",
      introduction: "各機能が、誰にどんな価値を届けるかを確認します。",
      rows: [
        {
          function: "予約・受付",
          audiences: "受付スタッフ、飼い主",
          value: "来院を迷わず正しく受け入れられる。",
        },
        {
          function: "診察・カルテ",
          audiences: "獣医師、病院スタッフ",
          value: "診療の記録を一貫して扱える。",
        },
        {
          function: "会計",
          audiences: "会計担当、飼い主",
          value: "確定した来院記録と会計を誤って壊さない。",
        },
        {
          function: "フォロー連絡、連絡先の管理、申し送り",
          audiences: "病院スタッフ、飼い主",
          value: "必要な連絡を安全に引き継げる。",
        },
      ],
    });

    expect(element.tagName).toBe("SECTION");
    expect(element.querySelector("h2")?.textContent).toBe("機能が届ける価値");
    expect(element.querySelector("p")?.textContent).toBe(
      "各機能が、誰にどんな価値を届けるかを確認します。",
    );
    expect(
      [...element.querySelectorAll("th")].map(({ textContent, scope }) => [textContent, scope]),
    ).toEqual([
      ["機能", "col"],
      ["届ける相手", "col"],
      ["価値", "col"],
    ]);
    expect(
      [...element.querySelectorAll("tbody tr")].map(({ textContent }) => textContent),
    ).toEqual([
      "予約・受付受付スタッフ、飼い主来院を迷わず正しく受け入れられる。",
      "診察・カルテ獣医師、病院スタッフ診療の記録を一貫して扱える。",
      "会計会計担当、飼い主確定した来院記録と会計を誤って壊さない。",
      "フォロー連絡、連絡先の管理、申し送り病院スタッフ、飼い主必要な連絡を安全に引き継げる。",
    ]);
  });
});

describe("renderOnboardingChapter", () => {
  it("オンボーディング章を見出しと区画ごとの意味論的な要素で描画する", () => {
    const chapter: OnboardingChapter = {
      id: "before-joining",
      heading: "開発に参加する前に",
      sections: [
        {
          kind: "business-context",
          id: "hospital-role",
          heading: "動物病院の役割",
          paragraphs: ["飼い主と病院スタッフを支えます。"],
        },
        {
          kind: "visit-flow",
          id: "visit-flow",
          heading: "1回の来院の流れ",
          introduction: "来院の順番を確認します。",
          steps: [{ title: "予約", description: "飼い主が予約する。" }],
          people: {
            id: "people",
            heading: "登場人物",
            items: [{ name: "飼い主", description: "診察を予約する。" }],
          },
        },
        {
          kind: "value-map",
          id: "function-and-value",
          heading: "提供する機能と価値",
          introduction: "対応を確認します。",
          rows: [{ function: "予約・受付", audiences: "飼い主", value: "迷わず来院できる。" }],
        },
        {
          kind: "visit-model",
          id: "visit-modeling",
          heading: "来院をモデリングしよう",
          introduction: "進み具合を記録します。",
          states: [{ label: "予約済み", code: "scheduled" }],
          rule: "会計済みの来院を診察中へ戻さない。",
        },
        {
          kind: "developer-guide",
          id: "developer-task",
          heading: "開発者として今日取り組むこと",
          introduction: "コードを確認します。",
          items: [{ title: "src/legacy", description: "現在の実装です。" }],
        },
      ],
    };
    const element = renderOnboardingChapter(chapter);

    expect(element.matches("section#before-joining.onboarding-chapter")).toBe(true);
    expect(element.firstElementChild?.matches("h2")).toBe(true);
    expect(element.firstElementChild?.textContent).toBe("開発に参加する前に");
    expect(
      [...element.children]
        .filter((child) => child.matches("section"))
        .map((child) => child.querySelector("h3")?.textContent),
    ).toEqual([
      "動物病院の役割",
      "1回の来院の流れ",
      "提供する機能と価値",
      "来院をモデリングしよう",
      "開発者として今日取り組むこと",
    ]);
    expect(element.querySelector("#visit-flow > ol > li")?.textContent).toContain("予約");
    expect(element.querySelector("#people > h4")?.textContent).toBe("登場人物");
    expect(element.querySelectorAll("#people li")).toHaveLength(1);
    expect(
      [...element.querySelectorAll("#function-and-value th")].map(({ textContent }) => textContent),
    ).toEqual(["機能", "利用者", "価値"]);
  });
});
