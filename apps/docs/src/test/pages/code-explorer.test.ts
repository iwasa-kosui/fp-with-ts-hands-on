import { describe, expect, it } from "vitest";
import CodeExplorerPage from "../../pages/code-explorer.astro";
import { createAstroContainer } from "../render-astro";

const previewNotice =
  "これは現行の clinic-example を使う実験用プレビューです。編集内容はこのブラウザ内だけで動作し、保存されません。教材の session 化に伴い、題材やファイル構成は変更される場合があります。";

describe("code explorer preview page", () => {
  it("renders the real state-modeling workspace as a load-hydrated standalone preview", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(CodeExplorerPage, {
      partial: false,
    });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector('a[href="/"]')).not.toBeNull();
    expect(document.body.textContent).toContain(previewNotice);
    expect(document.body.textContent).toContain(
      "状態遷移の実装と型・実行時テストを編集して実行します。",
    );
    expect(document.body.textContent).toContain(
      "exercises/01-state-modeling.test.ts",
    );
    expect(
      document.querySelector('[data-action="run"]')?.textContent,
    ).toContain("実行");
    expect(
      document.querySelector('[data-action="reset"]')?.textContent,
    ).toContain("リセット");
    expect(
      document.querySelector('[data-code-explorer="01-state-modeling"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('astro-island[client="load"]'),
    ).not.toBeNull();
  });
});
