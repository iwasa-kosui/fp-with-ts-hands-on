import { describe, expect, it } from "vitest";
import CodeExplorerPage from "../../pages/code-explorer.astro";
import { createAstroContainer } from "../render-astro";

const previewNotice =
  "これは Session 00 の開始 snapshot を使う実験用プレビューです。編集内容はこのブラウザ内だけで動作し、保存されません。";

describe("code explorer preview page", () => {
  it("renders the self-contained Session 00 snapshot as a load-hydrated standalone preview", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(CodeExplorerPage, {
      partial: false,
    });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector('a[href="/"]')).not.toBeNull();
    expect(document.body.textContent).toContain(previewNotice);
    expect(document.body.textContent).toContain(
      "事故を再現するテストと開始 snapshot を編集して実行します。",
    );
    expect(document.body.textContent).toContain(
      "exercises/incident.test.ts",
    );
    expect(
      document.querySelector('[data-action="run"]')?.textContent,
    ).toContain("実行");
    expect(
      document.querySelector('[data-action="reset"]')?.textContent,
    ).toContain("リセット");
    expect(
      document.querySelector('[data-code-explorer="00-break-the-app"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('astro-island[client="load"]'),
    ).not.toBeNull();
  });
});
