import { describe, expect, it } from "vitest";
import type { ContentBlock } from "../content/module-content";
import { renderContentBlock } from "./content-block";

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
});
